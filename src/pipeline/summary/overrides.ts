export interface Override {
  /** 差し替える要約。null なら要約を出さず定型文にする */
  summary: string | null;
  reason: string;
}

export type Overrides = Record<string, Override>;

/** 手で編集するファイルなので、形が崩れていたら公開せずに止める */
export function parseOverrides(value: unknown): Overrides {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("overrides must be an object");
  }
  for (const [id, override] of Object.entries(value)) {
    const { summary, reason } = (override ?? {}) as Partial<Override>;
    if (summary !== null && typeof summary !== "string") {
      throw new Error(`override ${id}: summary must be a string or null`);
    }
    if (typeof reason !== "string" || reason === "") {
      throw new Error(`override ${id}: reason is required`);
    }
  }
  return value as Overrides;
}
