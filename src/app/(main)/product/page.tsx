"use client";

import { useEffect, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { AddIcon, PageHeader, Section } from "@/components/page";
import { getJson, send } from "@/lib/api";
import { ListSkeleton } from "@/components/skeleton";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useLocalCache } from "@/lib/local-cache";

type Product = {
  id: string;
  name: string;
  done: boolean;
  store: string | null;
};

const NO_STORE = "구매처 미정";
const STORE_LIST_ID = "store-options";

function ProductEditor({
  product,
  onSave,
  onCancel,
}: {
  product: Product;
  onSave: (name: string, store: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [store, setStore] = useState(product.store ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || (next === product.name && store.trim() === (product.store ?? ""))) return onCancel();
    onSave(next, store.trim());
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="w-full space-y-2 py-2">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="물건" className="field" />
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          list={STORE_LIST_ID}
          maxLength={50}
          placeholder="구매처 (선택)"
          aria-label="구매처"
          className="field field-sm min-w-0 flex-1"
        />
        <EditActions onCancel={onCancel} />
      </div>
    </form>
  );
}

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 처음엔 이 기기에 저장해 둔 목록을 먼저 보여주고, 받아오면 최신으로
  const [loaded, setLoaded] = useState(false);
  const cache = useLocalCache<Product[]>(CACHE_KEYS.products, "", loaded ? products : null, (cached) => {
    setProducts(cached);
    setLoaded(true);
  });

  async function load() {
    const data = await getJson<{ products: Product[] }>("/api/products");
    if (!data) return;
    cache.markFresh();
    setProducts(data.products ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!(await send("/api/products", "POST", { name: name.trim(), store: store.trim() }))) return;
    // 같은 곳에서 여러 개 살 때가 많아서 구매처는 남겨둠
    setName("");
    load();
  }

  async function toggle(id: string, current: boolean) {
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, done: !current } : p)));
    if (!(await send(`/api/products/${id}`, "PATCH", { done: !current }))) load();
  }

  async function saveEdit(id: string, nextName: string, nextStore: string) {
    setEditingId(null);
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, name: nextName, store: nextStore || null } : p)));
    if (!(await send(`/api/products/${id}`, "PATCH", { name: nextName, store: nextStore }))) load();
  }

  async function remove(id: string) {
    setProducts((list) => list.filter((p) => p.id !== id));
    if (!(await send(`/api/products/${id}`, "DELETE"))) load();
  }

  async function clearDone() {
    if (!confirm(`산 물건 ${doneCount}개를 목록에서 지울까요?`)) return;
    setProducts((list) => list.filter((p) => !p.done));
    if (!(await send("/api/products?done=true", "DELETE"))) load();
  }

  const doneCount = products.filter((p) => p.done).length;
  const remaining = products.length - doneCount;
  // 자동완성/빠른 선택용. 자주 쓴 구매처 먼저
  const storeCounts = products.reduce<Record<string, number>>((acc, p) => {
    if (p.store) acc[p.store] = (acc[p.store] ?? 0) + 1;
    return acc;
  }, {});
  const knownStores = Object.keys(storeCounts).sort((a, b) => storeCounts[b] - storeCounts[a]);

  // 구매처별로 묶고, 미정은 맨 아래. 묶음 안에서는 안 산 것 먼저
  const groups = Object.entries(
    products.reduce<Record<string, Product[]>>((acc, p) => {
      (acc[p.store ?? NO_STORE] ??= []).push(p);
      return acc;
    }, {}),
  )
    .map(([key, items]) => [key, [...items].sort((a, b) => Number(a.done) - Number(b.done))] as const)
    .sort(([a], [b]) => (a === NO_STORE ? 1 : b === NO_STORE ? -1 : a.localeCompare(b, "ko")));

  return (
    <>
      <PageHeader
        title="장보기"
        sub={products.length === 0 ? "살 것을 적어두세요" : remaining > 0 ? `살 것 ${remaining}개` : "다 샀어요"}
      />

      <datalist id={STORE_LIST_ID}>
        {knownStores.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <form onSubmit={addProduct} className="composer space-y-3">
        <label htmlFor="new-product" className="composer-label">
          살 것 추가
        </label>
        <div className="flex items-center gap-3">
          <input
            id="new-product"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 우유, 휴지"
            className="composer-input"
          />
          <button type="submit" aria-label="추가" className="add-btn">
            <AddIcon />
          </button>
        </div>
        <div className="border-t pt-3">
          <label className="flex items-center gap-3">
            <span className="flex-none text-[13px] font-medium text-pencil">구매처</span>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              list={STORE_LIST_ID}
              maxLength={50}
              placeholder="예: 쿠팡, 이마트 (선택)"
              className="field field-sm min-w-0 flex-1"
            />
          </label>
          {knownStores.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {knownStores.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStore(store === s ? "" : s)}
                  aria-pressed={store === s}
                  className="chip h-7 px-3"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      <Section
        title="목록"
        aside={
          doneCount > 0 ? (
            <button type="button" onClick={clearDone} className="text-btn">
              산 것 {doneCount}개 지우기
            </button>
          ) : undefined
        }
      >
        {groups.length > 0 ? (
          groups.map(([key, items]) => (
            <div key={key}>
              <h3
                className="mt-5 flex items-baseline justify-between text-[13px] font-semibold"
                style={{ color: key === NO_STORE ? "var(--pencil)" : "var(--navy)" }}
              >
                {key}
                <span className="font-normal text-pencil">
                  {items.filter((p) => !p.done).length} / {items.length}
                </span>
              </h3>
              <ul>
                {items.map((p) => (
                  <li key={p.id} className="row">
                    {editingId === p.id ? (
                      <ProductEditor
                        product={p}
                        onSave={(nextName, nextStore) => saveEdit(p.id, nextName, nextStore)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <LedgerCheck checked={p.done} onChange={() => toggle(p.id, p.done)}>
                          {p.name}
                        </LedgerCheck>
                        <EditButton onClick={() => setEditingId(p.id)} />
                        <DeleteButton onClick={() => remove(p.id)} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          loaded ? <p className="empty">목록이 비어 있어요.</p> : <ListSkeleton />
        )}
      </Section>
    </>
  );
}
