import { NODE_STATUS, NODE_STATUSES } from "../../shared/nodeStatus";
import { sameFilter, type NodeBoardFilter } from "./useNodeBoardFilter";
import shared from "./shared.module.css";
import type { Faction } from "../../../types";

const UNCLAIMED: NodeBoardFilter = { kind: "unclaimed" };

export function NodeBoardFilters({
  factions,
  filter,
  onToggle,
  onClear,
}: {
  factions: Faction[];
  filter: NodeBoardFilter | null;
  onToggle: (filter: NodeBoardFilter) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className={shared.subTabs}>
        <button className={filter ? "" : shared.selected} onClick={onClear}>
          Tất cả
        </button>
        {factions.map((faction) => {
          const pill: NodeBoardFilter = { kind: "faction", id: faction.id };
          return (
            <button
              key={faction.id}
              className={`${shared.factionPill} ${sameFilter(filter, pill) ? shared.selected : ""}`}
              style={{ "--label": faction.labelColor } as React.CSSProperties}
              onClick={() => onToggle(pill)}
            >
              {faction.name}
            </button>
          );
        })}
      </div>
      <div className={`${shared.subTabs} ${shared.nodeFilters}`}>
        {NODE_STATUSES.map((status) => {
          const { Icon, label } = NODE_STATUS[status];
          const pill: NodeBoardFilter = { kind: "status", status };
          const active = sameFilter(filter, pill);
          return (
            <button
              key={status}
              className={active ? shared.selected : ""}
              aria-pressed={active}
              onClick={() => onToggle(pill)}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          );
        })}
        <button
          className={sameFilter(filter, UNCLAIMED) ? shared.selected : ""}
          aria-pressed={sameFilter(filter, UNCLAIMED)}
          onClick={() => onToggle(UNCLAIMED)}
        >
          Chưa chiếm
        </button>
      </div>
    </>
  );
}
