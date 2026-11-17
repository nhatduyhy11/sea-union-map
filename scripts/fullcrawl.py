"""Batch SEA crawler: chạy tuần tự mọi account trong auth JSON.

Mỗi key (email) trong ``<prefix>_allLoginList.value`` của auth JSON là một lượt
fresh-auth crawl qua ``tools/socket_log/sea_socket/crawler.py`` — cùng flow
``--auth-json PATH --acc EMAIL`` như chạy tay, chỉ khác gọi liền nhau:

- Trước/sau mỗi lượt log key + duration; mỗi dòng stdout của crawler có prefix
  ``[email]`` để phân biệt các lượt khi cuộn log.
- Account lỗi validation (thiếu access_token, username lệch key…) SKIP trước
  khi mở browser — dùng lại rule chọn account của ``browser/auth.py``.
- Crawl fail ghi FAIL rồi sang lượt kế, trừ khi ``--fail-fast``.
- Cuối chạy in bảng tổng kết + cảnh báo các acc cùng server (lượt ghi sau đè
  file ``<server>.json`` của lượt trước).

Usage:
    uv run python scripts/fullcrawl.py /path/to/auth.json
    uv run python scripts/fullcrawl.py /path/to/auth.json --dry-run
    uv run python scripts/fullcrawl.py /path/to/auth.json --headless \
        --dump-out src/data/snapshots/261116/

Auth JSON chỉ đọc, không bao giờ bị ghi lại; nên giữ ngoài repo hoặc trong
đường dẫn đã gitignore.
"""

import argparse
import json
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOCKET_LOG_ROOT = REPO_ROOT / "tools" / "socket_log"
CRAWLER = SOCKET_LOG_ROOT / "sea_socket" / "crawler.py"

sys.path.insert(0, str(SOCKET_LOG_ROOT))
try:
    from browser.auth import select_account
    from browser.navigation import colorize
    from sea_socket.report import SNAPSHOT_ROOT, event_day
except ImportError as exc:  # wrapper chạy bằng interpreter có playwright
    raise SystemExit(
        f"thiếu dependency crawler ({exc}) — chạy qua "
        f"'uv run python scripts/fullcrawl.py ...'"
    ) from None

SERVER_LINE = re.compile(r"\[meta\] logged-in server: (\S+)")
MATRIX_GREEN = "\033[38;5;46m"  # palette 256 màu #00ff00 — cùng kiểu với ORANGE
FAIL_RED = "\033[38;5;196m"
ANSI_COLOR = re.compile(r"\x1b\[[0-9;]*m")
LOG_DIR = REPO_ROOT / ".tmp"
_log_file = None


def fmt_duration(seconds: float) -> str:
    return f"{int(seconds) // 60}m{int(seconds) % 60:02d}s"


def emit(line: str) -> None:
    """In ra console + append vào log file (bỏ ANSI để file sạch)."""
    print(line, flush=True)
    if _log_file is not None:
        _log_file.write(ANSI_COLOR.sub("", line) + "\n")
        _log_file.flush()


def log(message: str) -> None:
    emit(f"[{time.strftime('%H:%M:%S')}] {message}")


def load_accounts(path: Path) -> tuple[object, list[str]]:
    """Trả về (source JSON, các email theo thứ tự trong file)."""
    try:
        source = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SystemExit(f"[auth] không đọc được auth JSON ({exc})") from None
    if not isinstance(source, dict):
        raise SystemExit("[auth] auth JSON phải là object của các key localStorage")
    lists = [key for key in source if key.endswith("_allLoginList")]
    if len(lists) != 1:
        raise SystemExit(
            f"[auth] cần đúng 1 key *_allLoginList, tìm thấy {len(lists)}")
    accounts = source[lists[0]].get("value") if isinstance(
        source[lists[0]], dict) else None
    if not isinstance(accounts, dict) or not accounts:
        raise SystemExit("[auth] allLoginList.value rỗng hoặc sai cấu trúc")
    return source, list(accounts)


def crawl_one(email: str, auth_path: Path, dump_out: Path, *,
              headless: bool, timeout_min: float) -> tuple[bool, str | None]:
    """Chạy 1 lượt crawler, stream stdout kèm prefix; trả (ok, server)."""
    cmd = [sys.executable, str(CRAWLER),
           "--auth-json", str(auth_path), "--acc", email,
           "--dump-out", str(dump_out)]
    if headless:
        cmd.append("--headless")
    started = time.monotonic()
    log(colorize(f"===== START acc: {email} =====", MATRIX_GREEN))
    server: str | None = None

    proc = subprocess.Popen(cmd, cwd=REPO_ROOT, text=True, encoding="utf-8",
                            errors="replace", stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, bufsize=1)
    # Watchdog chống crawl treo làm kẹt cả loạt: kill để dòng đọc thoát EOF.
    watchdog = (threading.Timer(timeout_min * 60, proc.kill)
                if timeout_min > 0 else None)
    if watchdog is not None:
        watchdog.daemon = True
        watchdog.start()
    assert proc.stdout is not None
    for line in proc.stdout:
        emit(f"  [{email}] {line.rstrip(chr(10))}")
        match = SERVER_LINE.search(line)
        if match and match.group(1) != "unknown":
            server = match.group(1)
    returncode = proc.wait()
    if watchdog is not None:
        watchdog.cancel()
    timed_out = returncode == -9  # SIGKILL từ watchdog
    elapsed = fmt_duration(time.monotonic() - started)
    if timed_out:
        log(colorize(f"===== FAIL  acc: {email} — quá {timeout_min:g} phút, "
                     f"bị kill ({elapsed}) =====", FAIL_RED))
        return False, server
    if returncode != 0:
        log(colorize(f"===== FAIL  acc: {email} — exit {returncode} ({elapsed}) =====",
                     FAIL_RED))
        return False, server
    dump = (dump_out / f"{server}.json") if server and not dump_out.suffix else dump_out
    log(colorize(f"===== DONE  acc: {email} ({elapsed}, server {server or '?'}) → {dump} =====",
                 MATRIX_GREEN))
    return True, server


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("auth_json", type=Path,
                        help="File JSON localStorage SDK (chỉ đọc)")
    parser.add_argument("--dump-out", type=Path, default=None,
                        help="Thư mục/file đích cho từng lượt crawl (mặc định "
                             "src/data/snapshots/<event-day>/)")
    parser.add_argument("--headless", action="store_true",
                        help="Chạy crawler không mở cửa sổ browser")
    parser.add_argument("--only", default=None,
                        help="Chỉ crawl các email này, phân tách bằng phẩy")
    parser.add_argument("--fail-fast", action="store_true",
                        help="Dừng cả loạt ở lượt FAIL đầu tiên")
    parser.add_argument("--timeout-min", type=float, default=0,
                        help="Giới hạn phút mỗi lượt (0 = không giới hạn); "
                             "quá hạn thì kill và ghi FAIL")
    parser.add_argument("--dry-run", action="store_true",
                        help="List account + validation, không crawl")
    args = parser.parse_args()

    auth_path = args.auth_json.resolve()
    source, emails = load_accounts(auth_path)
    if args.only:
        wanted = [item.strip() for item in args.only.split(",") if item.strip()]
        unknown = [email for email in wanted if email not in emails]
        if unknown:
            parser.error(f"--only chứa email không có trong auth JSON: {unknown}")
        emails = wanted

    # Validate trước bằng đúng rule của crawler (select_account tự deepcopy,
    # không đụng source), bỏ acc hỏng khỏi lượt chạy.
    runnable: list[str] = []
    skipped: list[tuple[str, str]] = []
    for email in emails:
        try:
            select_account(source, email)
            runnable.append(email)
        except (ValueError, TypeError) as exc:
            skipped.append((email, str(exc)))

    dump_out = (args.dump_out.resolve() if args.dump_out is not None
                else SNAPSHOT_ROOT / event_day())
    log(f"auth: {auth_path}")
    log(f"accounts: {len(emails)} ({len(runnable)} chạy, {len(skipped)} skip)")
    for email, reason in skipped:
        log(f"  SKIP {email}: {reason}")
    log(f"dump-out: {dump_out} ({'file cố định — lượt sau đè lượt trước!' if dump_out.suffix else 'mỗi server một <server>.json'})")
    if args.dry_run:
        for email in runnable:
            log(f"  RUN  {email}")
        log("dry-run: không crawl.")
        return

    results: list[tuple[str, str, str | None]] = []  # email, status, server
    global _log_file
    LOG_DIR.mkdir(exist_ok=True)
    log_path = LOG_DIR / f"fullcrawl.{time.strftime('%y%m%d_%H%M%S')}.log"
    _log_file = open(log_path, "w", encoding="utf-8")
    log(f"log: {log_path}")
    for index, email in enumerate(runnable, start=1):
        log(f"— lượt {index}/{len(runnable)} —")
        ok, server = crawl_one(email, auth_path, dump_out,
                               headless=args.headless,
                               timeout_min=args.timeout_min)
        results.append((email, "DONE" if ok else "FAIL", server))
        if not ok and args.fail_fast:
            log("fail-fast: dừng cả loạt.")
            break

    # Tổng kết gọn: trạng thái + server mỗi acc (thời lượng từng lượt ở log trên).
    log("===== TỔNG KẾT =====")
    width = max([len(row[0]) for row in results] + [len("email")]) if results else len("email")
    for email, status, server in results:
        log(f"  {email:<{width}}  {status}  server={server or '?'}")
    done_servers = [server for _, status, server in results
                    if status == "DONE" and server]
    for server in {s for s in done_servers if done_servers.count(s) > 1}:
        log(f"  WARN server {server}: nhiều acc cùng cụm — file dump bị lượt sau ghi đè.")
    failed = sum(1 for _, status, _ in results if status == "FAIL")
    if failed:
        log(f"{failed}/{len(results)} lượt FAIL — xem log từng lượt ở trên.")
        _log_file.close()
        sys.exit(1)
    _log_file.close()


if __name__ == "__main__":
    main()
