// brooks, Copyright 2026, Will Hawkins
//
// This file is part of brooks.

// This file is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// deno-lint-ignore-file no-explicit-any -- the from deserialization function requires non-typesafe code.

export class None {}

export type Option<T> = T | None;

/**
 * Set whether to emit debugging information for operations in this library.
 */
// deno-lint-ignore prefer-const
export let Debug: boolean = false;

export function isSome<T>(maybe: Option<T>): maybe is T {
  return maybe != None;
}

export function orDefault<T>(maybe: Option<T>, dfault: T): T {
  if (isSome(maybe)) {
    return maybe;
  }
  return dfault;
}

export class BrooksError {
  _msg: string;
  public constructor(msg: string) {
    this._msg = msg;
  }

  public get msg(): string {
    return this._msg;
  }
}

export type Result<T, E> = T | E;

export function isError<T>(
  maybeError: BrooksError | T,
): maybeError is BrooksError {
  return (maybeError as BrooksError)._msg !== undefined;
}

interface DefaultConstructible<T> {
  new (): T;
}

export function from<T extends object>(
  type: DefaultConstructible<T>,
  raw: any,
): Result<T, BrooksError> {
  if (Debug) {
    console.log(`Instantiating a ${type.name} from ${JSON.stringify(raw)}.`);
  }
  const result: any = new type();

  const md = __metadata.ctorClassFields.get(type);

  for (const [prop, prop_value] of Object.entries(result)) {
    if (Debug) {
      console.log(
        `Attempting to set value for ${prop} when constructing a ${type.name}.`,
      );
    }
    if (
      !(prop in raw) &&
      (prop_value == undefined)
    ) {
      return new BrooksError(`Missing ${prop}`);
    }

    if (!(prop in raw)) {
      // Let the None value suffice.
      if (Debug) {
        console.log(
          `Using the default value (${prop_value}) for ${prop} when constructing a ${type.name}.`,
        );
      }
      continue;
    }

    const rawValue = raw[prop];
    // Find out if there is a sub constructor.
    const ctor = md ? md.get(prop.toString()) : undefined;
    if (ctor) {
      // There is a sub constructor ... use it.

      if (Debug) {
        console.log(
          `Using a sub constructor ${ctor.name} for ${prop} when constructing a ${type.name}.`,
        );
      }

      const constructedFieldValue = from(
        ctor as DefaultConstructible<any>,
        rawValue,
      );
      if (isError(constructedFieldValue)) {
        console.error(
          `There was an error using a sub constructor ${ctor.name} for ${prop} when constructing a ${type.name}: ${constructedFieldValue.msg}.`,
        );
        return constructedFieldValue;
      }

      if (Debug) {
        console.log(
          `Successfully used a sub constructor ${ctor.name} for ${prop} when constructing a ${type.name}.`,
        );
      }
      result[prop] = constructedFieldValue;
    } else {
      // There is no sub constructor ... use whatever is the raw value.
      if (Debug) {
        console.log(
          `Using a raw value for ${prop} when constructing a ${type.name}.`,
        );
      }
      result[prop] = rawValue;
    }
  }
  return result;
}

export class MelInterpretResult {
  result: string = "";
  tpe: Option<string> = None;
}

export class MelErrorLocation {
  start: number = 0;
  extent: number = 0;
}

class Metadata {
  ctorClassFields: Map<object, Map<string, DefaultConstructible<any>>> = new Map();
}
const __metadata = new Metadata();

export class MelError {
  msg: string = "";
  @CtorClass(MelErrorLocation)
  location: Option<MelErrorLocation> = None;
}

export function CtorClass<T>(cls: DefaultConstructible<T>) {
  return function (owner: any, name: string) {
    if (__metadata.ctorClassFields.get(owner.constructor) == undefined) {
      __metadata.ctorClassFields.set(owner.constructor, new Map());
    }
    const objprops = __metadata.ctorClassFields.get(owner.constructor)!;
    objprops.set(name, cls);
  };
}
