import { kind, toString } from "./symbol";

export interface Variable<T> {
  [kind]: "variable";
  tsType: T;
  [toString]($: (expression: Expression) => string): string;
}

export interface Scalar<T> {
  [kind]: "scalar";
  tsType: T;
  // parameters(): Array<Exclude<Expression, Variable<any>>>;
  // [toString]($: (expression: Expression) => string): string;
  them(): [string, Array<Exclude<Expression, Variable<unknown>>>];
}

export type Expression<T = any> = null | number | bigint | string | Date | Variable<T> | Scalar<T>;
