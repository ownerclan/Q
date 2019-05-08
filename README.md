# Q
Typed query builder for Typescript

- Q gives you query strings with Typescript type of the query result.
- Q helps autocompletion for almost everything.
- Q doesn't do anything about data fetching. You have to run the query with `node-mysql` or something.
- Q doesn't support other RDBMSs than MySQL yet.

## getting started
```shell
npm i typescript@next # latest version(3.4) is unstable with `as const` keyword
npm i git@github.com:ownerclan/Q.git
```
> npm package is coming soon.

And type the code below in VS Code and you will love Q.

```typescript
import { count, distinct, Enum, Int, JSON, Q, q, SelectToTs, Table, Varchar } from "@mi6/Q";

const human =
  Table({
    id: Varchar({ length: 20 }),
    name: Varchar({ length: 10 }),
    age: Int(),
    height: Int(),
    car: Varchar({ length: 20 }).nullable(),
    gender: Enum(["male", "female"] as const),
    phones: JSON<Array<{ name: string, number: string }>>(),
  })
    .primaryKey("id");

const car =
  Table({
    id: Varchar({ length: 20 }).default(q`AUTO_INCREMENT`),
    model: Varchar({ length: 10 }).nullable(),
    weight: Int(),
  })
    .primaryKey(["id"]);

const tables = { human, car };
const qb = Q({ tables });

const query = qb.from("car")
  .join("human").on((joinee, $) => q`${joinee.car} = ${$.car.id}`) // A string literal without `q` tag is a just string value not sql expression.
  .where(({ car }) => q`${car.weight} < 500`)
  .groupBy(($) => [$.human.name, $.human.gender])
  .orderBy(($) => $.human.age)
  .orderBy(($, prev) => [...prev, $.human.height.desc()]) // previous value of orderBy is passed to prev
  .limit(100)
  .select(({ car, human }) => ({
    id: distinct(car.id),
    carCount: count(car.id),
    driverGender: human.gender,
    driverPhones: human.phones,
    somethingAny: q`AVERAGE(${human.age})`,
    somethingTyped: q<number>`AVERAGE(${human.age})`,
  }));
const [queryString, parameters] = query.them();
let result: SelectToTs<typeof query>;
// type `result.` and see what appears!

qb.insert("car").set({ model: "Z", weight: 700 }); // see what's optional and nullable!
qb.update("human")
  .where(($) => q`${$.human.name} = ${"pika"}`)
  .set(qb.from("human")
    .where(($) => q`${$.human.name} = ${"chu"}`)
    .select(($) => $.human));
```

## todo
- better names for functions and types
- named parameter
- left join, right join
- full support for update, insert
- delete
- not frequently used MySQL syntaxes I don't know yet
- and typed ORM **Bond** based upon Q