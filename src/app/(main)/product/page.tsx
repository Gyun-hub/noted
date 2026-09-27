"use client";

import { useEffect, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { EditButton, InlineEdit } from "@/components/inline-edit";
import { getJson, send } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  done: boolean;
};

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const data = await getJson<{ products: Product[] }>("/api/products");
    if (data) setProducts(data.products ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!(await send("/api/products", "POST", { name: name.trim() }))) return;
    setName("");
    load();
  }

  async function toggle(id: string, current: boolean) {
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, done: !current } : p)));
    if (!(await send(`/api/products/${id}`, "PATCH", { done: !current }))) load();
  }

  async function rename(id: string, next: string) {
    setEditingId(null);
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, name: next } : p)));
    if (!(await send(`/api/products/${id}`, "PATCH", { name: next }))) load();
  }

  async function remove(id: string) {
    setProducts((list) => list.filter((p) => p.id !== id));
    if (!(await send(`/api/products/${id}`, "DELETE"))) load();
  }

  async function clearDone() {
    if (!confirm(`완료한 ${doneCount}개 항목을 지울까요?`)) return;
    setProducts((list) => list.filter((p) => !p.done));
    if (!(await send("/api/products?done=true", "DELETE"))) load();
  }

  const doneCount = products.filter((p) => p.done).length;
  const remaining = products.length - doneCount;

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <header className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          장바구니
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent-2" />
          product
        </h1>
      </header>

      <form onSubmit={addProduct} className="mb-8 flex items-end gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="살 것 추가"
          className="ledger-input"
        />
        <button
          type="submit"
          aria-label="추가"
          className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent text-white transition-transform active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      <section className="rounded-xl border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
            목록
          </h2>
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
            {doneCount > 0 && (
              <button type="button" onClick={clearDone} className="hover:text-accent">
                완료 비우기
              </button>
            )}
            <span>{remaining}개 남음</span>
          </div>
        </div>

        {products.length > 0 ? (
          <ul className="space-y-3">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                {editingId === p.id ? (
                  <InlineEdit
                    value={p.name}
                    onSave={(next) => rename(p.id, next)}
                    onCancel={() => setEditingId(null)}
                    className="flex-1"
                  />
                ) : (
                  <>
                    <LedgerCheck checked={p.done} onChange={() => toggle(p.id, p.done)} className="flex-1">
                      {p.name}
                    </LedgerCheck>
                    <EditButton onClick={() => setEditingId(p.id)} />
                    <button
                      onClick={() => remove(p.id)}
                      aria-label="삭제"
                      className="grid h-6 w-6 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            목록 비어있음
          </p>
        )}
      </section>
    </div>
  );
}
