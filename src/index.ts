import * as _ from "lodash";

import { Column } from "./column";
import { Expression, Scalar, Variable } from "./expression";
import { kind, toString } from "./symbol";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface Table<Columns extends { [key: string]: Column<any, boolean, boolean> }> {
  readonly value: { columns: Columns, primaryKey: Array<keyof Columns & string> };

  primaryKey(key: (keyof Columns & string) | Array<keyof Columns & string>): Table<Columns>;
}

interface Schema {
  tables: { [key: string]: Table<any> };
  foreignKeys?: { [key: string]: Table<any> };
}

// NOTE: because of built-in Record
interface Record_ {
  [key: string]: Expression;
}

interface Aliases {
  [key: string]: Record_;
}

type RecordOfTable<T extends Table<{ [key: string]: Column<any, boolean, boolean> }>> = { [key in keyof T["value"]["columns"]]: Variable<T["value"]["columns"][key]["tsType"]> };

type TablePrimary<S extends Schema> = keyof S["tables"] | Select<Record_>;

type TsToRecord<T extends {}> = { [key in keyof T]: Variable<T[key]> };

type OrderDirection = "asc" | "desc";

type OrderBy = [Expression, OrderDirection];

interface OrderByBuilder {
  value: OrderBy;
  asc(): OrderByBuilder;
  desc(): OrderByBuilder;
}

interface SelectBuilder<S extends Schema, A extends Aliases> {
  readonly value: {
    from: TablePrimary<S>;
    aliases: A;
    joins: Array<[TablePrimary<S>, keyof A, ["on", Expression] | ["using", Expression | [Expression, Expression]]]>;
    where?: Expression;
    groupBy: { by: Expression[], having?: Expression };
    orderBy: OrderBy[];
    limit?: number;
    offset?: number;
  };

  join<T extends keyof S["tables"] & string>(table: T): JoiningBuilder<S, A, RecordOfTable<S["tables"][T]>, T>;
  join<T extends keyof S["tables"], A extends string>(table: T, alias: A): JoiningBuilder<S, A & { [key in A]: RecordOfTable<S["tables"][T]> }, RecordOfTable<S["tables"][T]>, A>;
  join<T extends Select<Record_>, A extends string>(query: T, alias: A): JoiningBuilder<S, A & { [key in A]: T["value"] }, T["value"], A>;

  where(fn: (aliases: A, prev?: Expression) => Expression): AfterJoinBuilder<S, A>;
  groupBy(fn: (aliases: A, prev?: Expression[]) => Expression | Expression[]): GroupingBuilder<S, A>;
  orderBy(fn: (aliases: { [key in keyof A]: { [key_ in keyof A[key]]: OrderByBuilder } }, prev?: OrderBy[]) => OrderByBuilder | OrderByBuilder[]): AfterJoinBuilder<S, A>;

  limit(value: number): AfterJoinBuilder<S, A>;
  offset(value: number): AfterJoinBuilder<S, A>;

  select<P extends Record_>(fn: (aliases: A) => P): Select<P>;
  scalar<P extends Expression>(fn: (aliases: A) => P): P;
}

type JoinBuilder<S extends Schema, A extends Aliases> = SelectBuilder<S, A>;
interface JoiningBuilder<S extends Schema, A extends Aliases, Joinee extends Record_, Alias extends string> {
  on(fn: (joinee: Joinee, aliases: A) => Expression): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
  using(left: keyof Joinee, right: keyof A[keyof A]): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
  using(left: keyof Joinee & keyof A[keyof A]): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
}

type AfterJoinBuilder<S extends Schema, A extends Aliases> = Omit<SelectBuilder<S, A>, "join">;
interface GroupingBuilder<S extends Schema, A extends Aliases> extends AfterJoinBuilder<S, A> {
  having(fn: (aliases: A, prev?: Expression) => Expression): AfterJoinBuilder<S, A>;
}

interface Select<Return extends Record_> {
  [kind]: "select";
  readonly value: Return;

  them(): readonly [string, Array<Exclude<Expression, Variable<unknown>>>];
}

type NullableColumns<T extends Table<any>["value"]["columns"]> =
  { [key in keyof T]: T[key]["value"]["nullable"] extends true ? key : never }[keyof T];
type OptionalColumns<T extends Table<any>["value"]["columns"]> = {
  [key in keyof T]: T[key]["value"]["nullable"] extends true
  ? key
  : T[key]["value"]["default"] extends undefined
  ? never
  : key }[keyof T];

type InsertValues<T extends Table<any>["value"]["columns"]> = {
  [key in OptionalColumns<T>]?: key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]
} & {
    [key in Exclude<keyof T, OptionalColumns<T>>]: key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]
  };

interface Insert {
  [kind]: "insert";

  them(): readonly [string, Array<Exclude<Expression, Variable<unknown>>>];
}

interface InsertBuilder<S extends Schema, T extends keyof S["tables"]> {
  set(value: InsertValues<S["tables"][T]["value"]["columns"]> | Select<TsToRecord<InsertValues<S["tables"][T]["value"]["columns"]>>>): Insert;
}

type UpdateValues<T extends Table<any>["value"]["columns"]> = {
  [key in keyof T]?: key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]
};

interface Update {
  [kind]: "update";

  them(): readonly [string, Array<Exclude<Expression, Variable<unknown>>>];
}

interface UpdateBuilder<S extends Schema, T extends keyof S["tables"], A extends Aliases> {
  value: {
    aliases: A,
    where: Expression,
  };

  set(value: UpdateValues<S["tables"][T]["value"]["columns"]> | Select<TsToRecord<UpdateValues<S["tables"][T]["value"]["columns"]>>>): Update;
  where(fn: (aliases: A) => Expression): UpdateBuilder<S, T, A>;
}

interface Q<S extends Schema> {
  from<T extends keyof S["tables"]>(table: T): SelectBuilder<S, { [key in T]: RecordOfTable<S["tables"][T]> }>;
  from<T extends keyof S["tables"], A extends string>(table: T, alias: A): SelectBuilder<S, { [key in A]: RecordOfTable<S["tables"][T]> }>;
  from<T extends Select<Record_>, A extends string>(query: T, alias: A): SelectBuilder<S, { [key in A]: T["value"] }>;

  insert<T extends keyof S["tables"]>(table: T): InsertBuilder<S, T>;
  update<T extends keyof S["tables"]>(table: T): UpdateBuilder<S, T, { [key in T]: RecordOfTable<S["tables"][T]> }>;
}

function isSelectQuery(s: any): s is Select<Record_> {
  return (s as Select<Record_>)[kind] === "select";
}

function isVariable(s: any): s is Variable<unknown> {
  return (s as Variable<unknown>)[kind] === "variable";
}

function isScalar(s: any): s is Scalar<unknown> {
  return (s as Scalar<unknown>)[kind] === "scalar";
}

export function Q<S extends Schema>(schema: S): Q<S> {
  function buildAlias(aliases: Aliases, table: TablePrimary<S>, alias?: string): [Record_, string] {
    if (typeof table === "string") {
      if (schema.tables[table] !== undefined) {
        const alias_ = alias || table;
        if (aliases[alias_] === undefined) {
          return [
            _.mapValues(schema.tables[table].value.columns,
              (_, k) => raw`\`${alias_}\`.\`${k}\``),
            alias_];
        } else {
          throw new Error("Duplicated alias!");
        }
      } else {
        throw new Error("Cannot find table in schmea");
      }
    } else if (isSelectQuery(table)) {
      if (alias !== undefined) {
        return [_.mapValues(table.value, (_, k) => raw`\`${alias}\`.\`${k}\``), alias];
      } else {
        throw new Error("Alias please");
      }
    }
    throw new Error();
  }

  function useStringifier() {
    const parameters: Array<Exclude<Expression, Variable<unknown>>> = [];
    function expressionToString(expression: Expression): string {
      if (expression === null) {
        return "NULL";
      } else if (isVariable(expression)) {
        return expression[toString](expressionToString);
      } else if (isScalar(expression)) {
        const [queryString, parameters_] = expression.them();
        parameters.push(...parameters_);
        return `(${queryString})`;
      }
      parameters.push(expression);
      return "?";
    }

    function tablePrimaryToString(tablePrimary: TablePrimary<S>): string {
      if (typeof tablePrimary === "string") {
        return `\`${tablePrimary}\``;
      } else if (isSelectQuery(tablePrimary)) {
        const [queryString, parameters_] = tablePrimary.them();
        parameters.push(...parameters_);
        return `(${queryString})`;
      }
      throw new Error();
    }
    return [expressionToString, tablePrimaryToString, parameters] as const;
  }

  return {
    from(table: TablePrimary<S>, alias?: string) {
      const [self, alias_] = buildAlias({}, table, alias);

      function buildSelect(value: SelectBuilder<S, Aliases>["value"]): AfterJoinBuilder<S, Aliases> {
        function queryToString(selectClauseFn: ($: (expression: Expression) => string) => string) {
          const [$, $$, parameters] = useStringifier();
          return [
            `SELECT ${selectClauseFn($)} FROM ${$$(value.from)} \`${alias_}\``
            + value.joins.map(([table, alias, clause]) =>
              ` JOIN ${$$(table)} \`${alias}\` ${clause[0] === "on"
                ? `ON ${$(clause[1])}`
                : `USING(${Array.isArray(clause[1])
                  ? `${$(clause[1][0])}, ${$(clause[1][1])}`
                  : $(clause[1])})`}`)
            + (value.where ? ` WHERE ${$(value.where)}` : "")
            + (value.groupBy.by.length ? " GROUP BY " + value.groupBy.by.map((i) => $(i)).join(", ") : "")
            + (value.groupBy.having ? ` HAVING ${$(value.groupBy.having)}` : "")
            + (value.orderBy.length ? (" ORDER BY " + value.orderBy.map(([by, direction]) => `${$(by)} ${direction.toUpperCase()}`).join(", ")) : "")
            + (value.limit !== undefined ? ` LIMIT ${value.limit}` : "")
            + (value.offset !== undefined ? ` OFFSET ${value.offset}` : ""),
            parameters] as const;
        }
        return {
          value,
          groupBy: (fn) => {
            const by = fn(value.aliases, value.groupBy.by);
            return {
              ...buildSelect({ ...value, groupBy: { by: Array.isArray(by) ? by : [by] } }),
              having(fn) {
                return buildSelect({ ...value, groupBy: { by: value.groupBy.by, having: fn(value.aliases) } });
              },
            };
          },
          orderBy(fn) {
            const value_ = fn(_.mapValues(value.aliases,
              (v) => _.mapValues(v, (v) => {
                function buildBuilder(value: OrderBy): OrderByBuilder {
                  return {
                    value,
                    asc() {
                      return buildBuilder([value[0], "asc"]);
                    },
                    desc() {
                      return buildBuilder([value[0], "desc"]);
                    },
                  };
                }
                return buildBuilder([v, "asc"]);
              })), value.orderBy);
            return buildSelect({ ...value, orderBy: [...value.orderBy, ...Array.isArray(value_) ? value_.map((i) => i.value) : [value_.value]] });
          },
          limit: (value_) => buildSelect({ ...value, limit: value_ }),
          offset: (value_) => buildSelect({ ...value, offset: value_ }),
          select(fn) {
            const value_ = fn(value.aliases);

            return {
              [kind]: "select",
              value: value_,
              them() {
                return queryToString(($) => Object.entries(value_).map(([k, v]) => `${$(v)} AS \`${k}\``).join(", "));
              },
            };
          },
          scalar(fn) {
            return {
              [kind]: "scalar",
              them() {
                return queryToString(($) => $(fn(value.aliases)));
              },
            } as any;
          },
          where(fn) {
            return buildSelect({ ...value, where: fn(value.aliases, value.where) });
          },
        };
      }

      // TODO: replace any to something more strict
      function buildJoin(value: SelectBuilder<S, Aliases>["value"]): JoinBuilder<S, any> {
        return {
          value,
          ...buildSelect(value),
          join(joinee: TablePrimary<S>, alias?: string) {
            const [self, alias_] = buildAlias(value.aliases, joinee, alias);
            const newValue = { ...value, aliases: { ...value.aliases, [alias_]: self } };
            return {
              on(fn: (self: Record_, aliases: Aliases) => Expression) {
                return buildJoin({ ...newValue, joins: [...value.joins, [joinee, alias_, ["on", fn(self, value.aliases)]]] });
              },
              using(left: string, right?: string) {
                return buildJoin({ ...newValue, joins: [...value.joins, [joinee, alias_, ["using", right === undefined ? left : [left, right]]]] });
              },
            } as any;
          },
        };
      }
      return buildJoin({ from: table, joins: [], aliases: { [alias_]: self }, orderBy: [], groupBy: { by: [] } });
    },
    insert(table) {
      const [$, , parameters] = useStringifier();
      return {
        set(value) {
          return {
            [kind]: "insert",
            them() {
              return [
                `INSERT INTO \`${table}\``
                + (isSelectQuery(value)
                  ? ` (${Object.keys(value).map((i) => `\`${i}\``).join(", ")}) ${value}`
                  // NOTE: v !== undefined looks unnecessary and maybe `as any` also
                  : ` SET ${Object.entries(value).map(([k, v]) => v !== undefined ? `\`${k}\` = ${$(v as any)}` : "").join(", ")}`),
                parameters];
            },
          };

        },
      };
    },
    update(table) {
      function buildBuilder(value: UpdateBuilder<S, keyof S["tables"], Aliases>["value"]): UpdateBuilder<S, keyof S["tables"], Aliases> {
        const [$, , parameters] = useStringifier();
        return {
          value,
          set(value_) {
            const where = value.where ? ` WHERE ${$(value.where)}` : "";
            return {
              [kind]: "update",
              them() {
                return [
                  `UPDATE \`${table}\` SET` +
                  (isSelectQuery(value_)
                    ? ` (${Object.keys(value_.value).map((k) => `\`${k}\``).join(", ")}) = (${value_})`
                    // NOTE: v !== undefined looks unnecessary
                    : ` ${Object.entries(value_).map(([k, v]) => v !== undefined ? `\`${k}\` = ${$(v)}` : "").join(", ")}`)
                  + where,
                  parameters];
              },
            };
          },
          where(fn) {
            return buildBuilder({ ...value, where: fn(value.aliases) });
          },
        };
      }
      const [self, alias] = buildAlias({}, table);
      return buildBuilder({ aliases: { [alias]: self }, where: "" }) as any;
    },
  };
}

export function Table<T extends { [key: string]: Column<any, boolean, boolean> }>(columns: T): Table<T> {
  function buildBuilder(value: Table<any>["value"]): Table<any> {
    return {
      value,
      primaryKey(key: any): Table<any> {
        if (typeof key === "string") {
          return buildBuilder({ ...value, primaryKey: [key] });
        } else {
          return buildBuilder({ ...value, primaryKey: key });
        }
      },
    };
  }
  return buildBuilder({ columns, primaryKey: [] });
}

function raw<T = any>(text: readonly string[], ...args: Expression[]): Variable<T> {
  return {
    [kind]: "variable",
    parameters() {
      return [];
    },
    [toString]() {
      return args.map((i, j) => text[j] + `${i}`).join("") + text.slice(args.length).join("");
    },
  } as any;
}

export function q<T = any>(text: readonly string[], ...args: Expression[]): Variable<T> {
  return {
    [kind]: "variable",
    parameters() {
      return [];
    },
    [toString]($: (expression: Expression) => string) {
      return args.map((i, j) => text[j] + $(i)).join("") + text.slice(args.length).join("");
    },
  } as any;
}

export type ExpressionToTs<T extends Expression> = T extends { tsType: any } ? T["tsType"] : unknown;
export type SelectToTs<T extends Select<Record_>> = { [key in keyof T["value"]]: ExpressionToTs<T["value"][key]> };

export * from "./sqlFunction";
export * from "./columnTypes";
