// The plans (lib/billing.ts), as cards: the one a club's team count needs marked.
import { PLANS, PLAN_IDS, price, teamsLabel, type PlanId } from "@/lib/billing";

export default function PlanList({ suggested }: { suggested?: PlanId }) {
  return (
    <div className="flex flex-col gap-2.5">
      {PLAN_IDS.map((id) => (
        <div
          key={id}
          className={`flex items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left dark:bg-[#1c1c1e] ${
            id === suggested ? "border-green-600" : "border-transparent"
          }`}
        >
          <span>
            <span className="block font-bold text-gray-900 dark:text-gray-50">
              {PLANS[id].name}
              {id === suggested && <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">Your club</span>}
            </span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">{teamsLabel(id)} · every feature</span>
          </span>
          <span className="text-right">
            <span className="block font-extrabold text-gray-900 dark:text-gray-50">{price(PLANS[id].monthly)}<span className="text-xs font-semibold text-gray-500">/month</span></span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">or {price(PLANS[id].yearly)} a year</span>
          </span>
        </div>
      ))}
    </div>
  );
}
