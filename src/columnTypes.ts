import { Column, columnBuilder } from "./column";

export function TinyInt(options?: { length: number }): Column<number> {
  return columnBuilder(options);
}

export function Int(options?: { length: number }): Column<number> {
  return columnBuilder(options);
}

export function Varchar(options?: { length: number }): Column<string> {
  return columnBuilder(options);
}

export function Enum<T extends { [key: number]: string }>(values: T): Column<T[number]> {
  return columnBuilder({ values });
}

export function Timestamp(): Column<Date> {
  return columnBuilder();
}

export function JSON<T extends {}>(): Column<T> {
  return columnBuilder();
}
