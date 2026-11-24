"use client";

import { useBillFormStore } from "@/stores/billFormStore";
import { btnLink, btnSecondary, formatMoney } from "./ui";
import { parseNumber } from "@/stores/billFormStore";

const cell =
  "w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500";
const cellCls = (err?: string) => `${cell} ${err ? "border-rose-400" : "border-zinc-200"}`;

/** ตารางรายการสินค้า: ชื่อ / จำนวน / หน่วย / ราคาต่อหน่วย / จำนวนเงิน (แถวว่างไม่ถูกส่ง) */
export function BillItemsEditor() {
  const items = useBillFormStore((s) => s.items);
  const errors = useBillFormStore((s) => s.errors);
  const addItem = useBillFormStore((s) => s.addItem);
  const updateItem = useBillFormStore((s) => s.updateItem);
  const removeItem = useBillFormStore((s) => s.removeItem);
  const moveItem = useBillFormStore((s) => s.moveItem);
  const sumItemsToSubtotal = useBillFormStore((s) => s.sumItemsToSubtotal);

  const sum = items.reduce((acc, it) => {
    const n = parseNumber(it.amount);
    return n !== null && !Number.isNaN(n) ? acc + n : acc;
  }, 0);

  return (
    <div>
      {errors.items && <p className="mb-2 text-xs text-rose-600">{errors.items}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="w-8 pb-2">#</th>
              <th className="pb-2">รายการ</th>
              <th className="w-24 pb-2">จำนวน</th>
              <th className="w-24 pb-2">หน่วย</th>
              <th className="w-28 pb-2">ราคา/หน่วย</th>
              <th className="w-32 pb-2">จำนวนเงิน</th>
              <th className="w-24 pb-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const err = (f: string) => errors[`items.${i}.${f}` as keyof typeof errors];
              return (
                <tr key={it.key} className="align-top">
                  <td className="py-1 pr-2 pt-3 text-xs text-zinc-400">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`รายการที่ ${i + 1}`}
                      value={it.name}
                      onChange={(e) => updateItem(it.key, { name: e.target.value })}
                      maxLength={255}
                      className={cellCls(err("name"))}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`จำนวน แถว ${i + 1}`}
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                      className={cellCls(err("quantity"))}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`หน่วย แถว ${i + 1}`}
                      value={it.unit}
                      onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                      maxLength={30}
                      placeholder="ชิ้น"
                      className={cellCls(err("unit"))}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`ราคาต่อหน่วย แถว ${i + 1}`}
                      inputMode="decimal"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })}
                      className={cellCls(err("unitPrice"))}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`จำนวนเงิน แถว ${i + 1}`}
                      inputMode="decimal"
                      value={it.amount}
                      onChange={(e) => updateItem(it.key, { amount: e.target.value })}
                      className={cellCls(err("amount"))}
                    />
                    {(err("quantity") || err("unitPrice") || err("amount")) && (
                      <p className="mt-0.5 text-[11px] text-rose-600">ตัวเลขไม่ถูกต้อง</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1 pt-2 text-right">
                    <button type="button" title="เลื่อนขึ้น" className="px-1 text-zinc-400 hover:text-zinc-700" disabled={i === 0} onClick={() => moveItem(it.key, -1)}>
                      ↑
                    </button>
                    <button type="button" title="เลื่อนลง" className="px-1 text-zinc-400 hover:text-zinc-700" disabled={i === items.length - 1} onClick={() => moveItem(it.key, 1)}>
                      ↓
                    </button>
                    <button type="button" title="ลบแถว" className="px-1 text-rose-400 hover:text-rose-600" onClick={() => removeItem(it.key)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={btnSecondary} onClick={addItem}>
          + เพิ่มรายการ
        </button>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>
            รวมจำนวนเงิน: <b className="text-zinc-900">{formatMoney(sum)}</b>
          </span>
          <button type="button" className={btnLink} onClick={sumItemsToSubtotal}>
            ใส่เป็นยอดก่อน VAT
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        แก้จำนวนหรือราคาต่อหน่วย ระบบคำนวณจำนวนเงิน (จำนวน × ราคา) และรวมจำนวนเงินให้ทันที · แก้จำนวนเงินเองได้ · แถวที่ว่างทั้งแถวจะไม่ถูกบันทึก
      </p>
    </div>
  );
}
