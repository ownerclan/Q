import {Expression} from "./expression";

export interface Column<T, Nullable extends boolean = false, Default extends boolean = false> {
  readonly value: { nullable: Nullable, default: Default extends true ? T | Expression : undefined };
  readonly tsType: T;

  nullable(): Column<T, true, Default>;
  default(value: T | Expression<T>): Column<T, Nullable, true>;
}

export function columnBuilder<T>(options?: any): Column<T> {
  function buildBuilder(value: { nullable: boolean, default?: T | Expression<T> }): Column<T, boolean, boolean> {
    return {
      options,
      nullable() {
        return buildBuilder({ ...value, nullable: true });
      },
      default(value_: T | Expression) {
        return buildBuilder({ ...value, default: value_ });
      },
    } as any;
  }
  return buildBuilder({ nullable: false }) as any;
}
