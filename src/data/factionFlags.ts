const factionFlags: Record<string, string> = {
  east: "Vinh_thao_thiet_flag.webp",
  south: "Long_khu_flag.webp",
  north: "Than_tu_flag.webp",
  west: "Thanh_dao_flag.webp",
};

export function factionFlagUrl(factionId: string): string | undefined {
  const file = factionFlags[factionId.replace(/^base-/, "")];
  return file ? `${import.meta.env.BASE_URL}faction/${file}` : undefined;
}
