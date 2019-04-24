import { Expression, Variable } from "./expression";
import { q } from "./index";

export function count(x: Expression<unknown>): Variable<number> {
  return q`COUNT(${x})`;
}

export function sum(x: Expression<unknown>): Variable<number> {
  return q`SUM(${x})`;
}

export function avg(x: Expression<unknown>): Variable<number> {
  return q`AVG(${x})`;
}

export function distinct<T>(x: Expression<T>): Variable<T> {
  return q`DISTINCT(${x})`;
}

export function between<T = 0 | 1>(x: Expression<unknown>, left: Expression<unknown>, right: Expression<unknown>): Variable<T> {
  return q`(${x}) BETWEEN (${left}) AND (${right})`;
}

export function and(left: Expression<unknown>, right: Expression<unknown>): Variable<0 | 1> {
  return q`(${left}) AND (${right})`;
}

export function or(left: Expression<unknown>, right: Expression<unknown>): Variable<0 | 1> {
  return q`(${left}) OR (${right})`;
}
