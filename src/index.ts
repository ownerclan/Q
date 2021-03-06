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
    joins: Array<["inner" | "left" | "right", TablePrimary<S>, string & keyof A, ["on", Expression] | ["using", string[]]]>;
    where?: Expression;
    groupBy: { by: Expression[], having?: Expression };
    orderBy: OrderBy[];
    limit?: number;
    offset?: number;
  };

  join<T extends keyof S["tables"] & string>(table: T): JoiningBuilder<S, A, RecordOfTable<S["tables"][T]>, T>;
  join<T extends keyof S["tables"], Alias extends string>(table: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: RecordOfTable<S["tables"][T]> }, RecordOfTable<S["tables"][T]>, Alias>;
  join<T extends Select<Record_>, Alias extends string>(query: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: T["value"] }, T["value"], Alias>;

  leftJoin<T extends keyof S["tables"] & string>(table: T): JoiningBuilder<S, A, RecordOfTable<S["tables"][T]>, T>;
  leftJoin<T extends keyof S["tables"], Alias extends string>(table: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: RecordOfTable<S["tables"][T]> }, RecordOfTable<S["tables"][T]>, Alias>;
  leftJoin<T extends Select<Record_>, Alias extends string>(query: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: T["value"] }, T["value"], Alias>;

  rightJoin<T extends keyof S["tables"] & string>(table: T): JoiningBuilder<S, A, RecordOfTable<S["tables"][T]>, T>;
  rightJoin<T extends keyof S["tables"], Alias extends string>(table: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: RecordOfTable<S["tables"][T]> }, RecordOfTable<S["tables"][T]>, Alias>;
  rightJoin<T extends Select<Record_>, Alias extends string>(query: T, alias: Alias): JoiningBuilder<S, A & { [key in Alias]: T["value"] }, T["value"], Alias>;

  where(fn: (aliases: A, prev?: Expression) => Expression): AfterJoinBuilder<S, A>;
  groupBy(fn: (aliases: A, prev: Expression[]) => Expression | Expression[]): GroupingBuilder<S, A>;
  orderBy(fn: (aliases: { [key in keyof A]: { [key_ in keyof A[key]]: OrderByBuilder } }, prev: OrderByBuilder[]) => OrderByBuilder | OrderByBuilder[]): AfterJoinBuilder<S, A>;

  limit(value: number): AfterJoinBuilder<S, A>;
  offset(value: number): AfterJoinBuilder<S, A>;

  select<P extends Partial<Record_>>(fn: (aliases: A) => P): Select<P>;
  scalar<P extends Expression>(fn: (aliases: A) => P): P;
}

type JoinBuilder<S extends Schema, A extends Aliases> = SelectBuilder<S, A>;
interface JoiningBuilder<S extends Schema, A extends Aliases, Joinee extends Record_, Alias extends string> {
  a: keyof A;
  b: keyof A[keyof A];
  c: Joinee;
  on(fn: (joinee: Joinee, aliases: A) => Expression): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
  using(column: keyof Joinee & keyof A[keyof A]): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
  using(columns: Array<keyof Joinee & keyof A[keyof A]>): SelectBuilder<S, A & { [key in Alias]: Joinee }>;
}

type AfterJoinBuilder<S extends Schema, A extends Aliases> = Omit<SelectBuilder<S, A>, "join" | "leftJoin" | "rightJoin">;
interface GroupingBuilder<S extends Schema, A extends Aliases> extends AfterJoinBuilder<S, A> {
  having(fn: (aliases: A, prev?: Expression) => Expression): AfterJoinBuilder<S, A>;
}

// NOTE: useful for partially typed code
interface Select<Return extends Partial<Record_>> {
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

type VariableOrRaw<T> = Variable<T> | T;

type InsertValues<T extends Table<any>["value"]["columns"]> = {
  [key in OptionalColumns<T>]?: VariableOrRaw<key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]>
} & {
    [key in Exclude<keyof T, OptionalColumns<T>>]: VariableOrRaw<key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]>
  };

interface Insert {
  [kind]: "insert";

  them(): readonly [string, Array<Exclude<Expression, Variable<unknown>>>];
}

interface InsertBuilder<S extends Schema, T extends keyof S["tables"]> {
  set(value: InsertValues<S["tables"][T]["value"]["columns"]> | Select<InsertValues<S["tables"][T]["value"]["columns"]>>): Insert;
}

type UpdateValues<T extends Table<any>["value"]["columns"]> = {
  [key in keyof T]?: VariableOrRaw<key extends NullableColumns<T> ? T[key]["tsType"] | null : T[key]["tsType"]>
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

  set(value: UpdateValues<S["tables"][T]["value"]["columns"]> | Select<UpdateValues<S["tables"][T]["value"]["columns"]>>): Update;
  where(fn: (aliases: A) => Expression): UpdateBuilder<S, T, A>;
}

interface Q<S extends Schema> {
  from<T extends keyof S["tables"] & string>(table: T): SelectBuilder<S, { [key in T]: RecordOfTable<S["tables"][T]> }>;
  from<T extends keyof S["tables"] & string, A extends string>(table: T, alias: A): SelectBuilder<S, { [key in A]: RecordOfTable<S["tables"][T]> }>;
  from<T extends Select<Record_>, A extends string>(query: T, alias: A): SelectBuilder<S, { [key in A]: T["value"] }>;

  insert<T extends keyof S["tables"] & string>(table: T): InsertBuilder<S, T>;
  update<T extends keyof S["tables"] & string>(table: T): UpdateBuilder<S, T, { [key in T]: RecordOfTable<S["tables"][T]> }>;
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

function quote(x: string): string {
  return "`" + x + "`";
}

export function Q<S extends Schema>(schema: S): Q<S> {
  function buildAlias(aliases: Aliases, table: TablePrimary<S>, alias?: string): [Record_, string] {
    if (typeof table === "string") {
      if (schema.tables[table] !== undefined) {
        const alias_ = alias || table;
        if (aliases[alias_] === undefined) {
          return [
            _.mapValues(schema.tables[table].value.columns,
              (_, k) => raw`${quote(alias_)}.${quote(k)}`),
            alias_];
        } else {
          throw new Error("Duplicated alias!");
        }
      } else {
        throw new Error("Cannot find table in schmea");
      }
    } else if (isSelectQuery(table)) {
      if (alias !== undefined) {
        return [_.mapValues(table.value, (_, k) => raw`${quote(alias)}.${quote(k)}`), alias];
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
        return quote(tablePrimary);
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
            `SELECT ${selectClauseFn($)} FROM ${$$(value.from)} ${quote(alias_)}`
            + value.joins.map(([type, table, alias, clause]) =>
              `${type === "inner" ? "" : ` ${type.toUpperCase()}`} JOIN ${$$(table)} ${quote(alias)} ${clause[0] === "on"
                ? `ON ${$(clause[1])}`
                : `USING(${clause[1].map(quote).join(",")})`}`).join("")
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
            const value_ = fn(_.mapValues(value.aliases,
              (v) => _.mapValues(v, (v) => buildBuilder([v, "asc"]))), value.orderBy.map(buildBuilder));
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
                return queryToString(($) => Object.entries(value_).map(([k, v]) => v !== undefined ? `${$(v)} AS ${quote(k)}` : "").join(", "));
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
        function _(joinType: "inner" | "left" | "right") {
          return (joinee: TablePrimary<S>, alias?: string) => {
            const [self, alias_] = buildAlias(value.aliases, joinee, alias);
            const newValue = { ...value, aliases: { ...value.aliases, [alias_]: self } };
            return {
              on(fn: (self: Record_, aliases: Aliases) => Expression) {
                return buildJoin({ ...newValue, joins: [...value.joins, [joinType, joinee, alias_, ["on", fn(self, value.aliases)]]] });
              },
              using(columnOrColumns: string | string[]) {
                const columns = Array.isArray(columnOrColumns) ? columnOrColumns : [columnOrColumns];
                return buildJoin({ ...newValue, joins: [...value.joins, [joinType, joinee, alias_, ["using", columns]]] });
              },
            } as any;
          };
        }
        return {
          value,
          ...buildSelect(value),
          join: _("inner"),
          leftJoin: _("left") as any,
          rightJoin: _("right") as any,
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
                `INSERT INTO ${quote(table)}`
                + (isSelectQuery(value)
                  ? ` (${Object.keys(value).map(quote).join(", ")}) ${value}`
                  // NOTE: v !== undefined looks unnecessary and maybe `as any` also
                  : ` SET ${Object.entries(value).map(([k, v]) => v !== undefined ? `${quote(k)} = ${$(v as any)}` : "").join(", ")}`),
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
                  `UPDATE ${quote(table)} SET` +
                  (isSelectQuery(value_)
                    ? ` (${Object.keys(value_.value).map(quote).join(", ")}) = (${value_})`
                    // NOTE: v !== undefined doesn't work. why???
                    : ` ${Object.entries(value_).map(([k, v]) => `${quote(k)} = ${$(v as any)}`).join(", ")}`)
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

export type ExpressionToTs<T extends Expression> = T extends { tsType: any } ? T["tsType"] : T;

type PartialProperties<T> = Exclude<{ [key in keyof T]: undefined extends T[key] ? key : never }[keyof T], undefined>;
export type SelectToTs<T extends Select<Partial<Record_>>> =
  { [key in PartialProperties<T["value"]>]?: ExpressionToTs<Exclude<T["value"][key], undefined>> }
& { [key in Exclude<keyof T["value"], PartialProperties<T["value"]>>]: T["value"][key] };

export * from "./sqlFunction";
export * from "./columnTypes";
