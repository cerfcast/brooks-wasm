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

import "./App.css";
//@deno-types="./../lib/brooks_wasm_lib.d.ts"
import { compile_and_serialize } from "./../lib/brooks_wasm_lib.js";
import { useRef, useState } from "react";
import {
  from,
  isError,
  isSome,
  MelError,
  MelInterpretResult,
  None,
  orDefault,
} from "./Brooks.ts";

const MelCompilerVersion = "0.1.13";

type VirtualRequestMethod = "GET" | "POST";

const VirtualRequestMethods: Map<VirtualRequestMethod, string> = new Map([
  ["GET", "GET"],
  ["POST", "POST"],
]);

class VirtualRequest {
  public method: VirtualRequestMethod;
  public uri: string;
  public headers: Map<string, string>;

  public constructor() {
    this.method = "GET";
    this.uri = "https://www.example.com/";
    this.headers = new Map<string, string>();
  }

  public static default(): VirtualRequest {
    const def = new VirtualRequest();
    def.method = "GET";
    def.uri = "https://www.example.com/";
    def.headers = new Map<string, string>();
    def.headers.set("Cookie", "cname1=cvalue1; cname2=cvalue2");
    return def;
  }

  public new_method(nm: VirtualRequestMethod): VirtualRequest {
    const res = new VirtualRequest();
    res.headers = new Map<string, string>(this.headers);
    res.uri = this.uri;
    res.method = nm;
    return res;
  }

  public new_uri(nu: string): VirtualRequest {
    const res = new VirtualRequest();
    res.headers = new Map<string, string>(this.headers);
    res.method = this.method;
    res.uri = nu;
    return res;
  }

  public insert_header(name: string, value: string): VirtualRequest {
    const res = new VirtualRequest();
    res.headers = new Map<string, string>(this.headers);
    res.headers.set(name, value);
    res.method = this.method;
    res.uri = this.uri;
    return res;
  }

  public clear_header(name: string): VirtualRequest {
    const res = new VirtualRequest();
    res.headers = new Map<string, string>(this.headers);
    res.headers.delete(name);
    res.method = this.method;
    res.uri = this.uri;
    return res;
  }

  public toString(): string {
    return `Method: ${this.method}; ` +
      [...this.headers.entries()].map(([k, v]) => {
        return `${k}: ${v}`;
      }).join(";");
  }

  public jsonify(): string {
    return `{
      "method": "${this.method}",
      "uri": "${this.uri}",
      "headers": [
      ${
      [...this.headers.entries()].map(([k, v]) => {
        return `{
          "name": "${k}",
          "value": "${v}"
        }`;
      }).join(",\n")
    }
    ]
    }`;
  }
}

interface VirtualRequestProps {
  request: VirtualRequest;
  update_request: React.Dispatch<React.SetStateAction<VirtualRequest>>;
}

function VirtualRequestBuilder(
  { request, update_request }: VirtualRequestProps,
) {
  const newHeaderName = useRef<HTMLInputElement | null>(null);
  const newHeaderValue = useRef<HTMLInputElement | null>(null);
  const newUriValue = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <hr />
      <b>Request</b>
      <br />

      <div className="request_method_uri">
        <select
          name={request.method}
          onChange={(e) =>
            update_request((request) =>
              request.new_method(e.target.value as VirtualRequestMethod)
            )}
        >
          {[...VirtualRequestMethods.keys()].map((method) => {
            return (
              <option key={VirtualRequestMethods.get(method)} value={method}>
                {method}
              </option>
            );
          })}
        </select>
        &nbsp;
        <input
          className="uri"
          type="text"
          ref={newUriValue}
          value={request.uri}
          onChange={(_) =>
            update_request((request) =>
              request.new_uri(
                newUriValue.current ? newUriValue.current.value : "",
              )
            )}
        />
      </div>
      <table className="request_headers">
        <thead>
          <tr>
            <th className="column_header">
              Header Name
            </th>
            <th className="column_header">
              Header Value
            </th>
          </tr>
        </thead>
        <tbody>
          {[...request.headers.entries()].map(([nme, value]) => {
            return (
              <tr key={nme}>
                <td>{nme}</td>
                <td>{value}</td>
                <td>
                  <button
                    type="button"
                    onClick={(_) => {
                      update_request((request) => request.clear_header(nme));
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}

          <tr>
            <td>
              <input ref={newHeaderName}></input>
            </td>
            <td>
              <input ref={newHeaderValue}></input>
            </td>
            <td>
              <button
                type="button"
                onClick={(_) => {
                  const headerName = newHeaderName.current
                    ? newHeaderName.current.value
                    : "";
                  const headerValue = newHeaderValue.current
                    ? newHeaderValue.current.value
                    : "";
                  if (newHeaderName.current) {
                    newHeaderName.current.value = "";
                  }
                  if (newHeaderValue.current) {
                    newHeaderValue.current.value = "";
                  }

                  update_request((request) =>
                    request.insert_header(
                      headerName,
                      headerValue,
                    )
                  );
                }}
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
    </>
  );
}

interface TryItOutProps {
  source: React.Dispatch<React.SetStateAction<string>>;
  compile: (a: string) => void;
}

function TryItOut({ source, compile }: TryItOutProps) {
  const exprs = [
    ["5 + 3", ""],
    ["req^h^cookie", ""],
    ["req^method", ""],
    ['path_element("f", 2)', ""],
    ["path_element(req^uri^path, 2)", ""],
    ['path_element("f")', "Will Produce A Arguments/Parameters Error"],
    ["5 + (8 + 2)", ""],
    ["true and false", ""],
    ["5 + false", "Will Produce A Type Error"],
    ["88 % 2", ""],
    ["boolean(5)", ""],
    ['boolean("hello")', ""],
    ['integer("505")', ""],
    ["real(true)", ""],
    ["true ? 5 : 4", ""],
    ['true ? "a" : false ? "b" : 10', "Will Produce A Type Error"],
    ["false ? 3 : false ? 8 : (19 + 1) / 2", ""],
    ['"testing" ~= /t.*ng/', ""],
    ["567 ~= /t.*ng/", "Will Produce a Type Error"],
    [
      '"testing" ~= /t[.*ng/',
      "Will Produce A Regular Expression Compilation Error",
    ],
    ["8.8.8.8 ipmatch 8.8.8.8", ""],
    ["8.8.8.8 ipmatch 2001:0db8:85a3:0000:0000:8a2e:0370:7334", ""],
  ];
  return (
    <>
      <div className="try">
        <b>Try out these MEL expressions:</b>
        <ul>
          {exprs.map((v: Array<string>, i) => {
            return (
              <li key={i}>
                <a
                  href="#"
                  onClick={() => {
                    source(v[0]);
                    setTimeout(() => {
                      compile(v[0]);
                    }, 1);
                  }}
                >
                  {v[0]}
                </a>
                {v[1].length != 0 ? ` - ${v[1]}` : ""}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function Changelog() {
  const items = [
    "Type checking is supported.",
    "Constant folding is supported (for some binary expressions).",
    "Better type checking of function calls.",
    "Updated examples.",
    "Precedences among operators are supported.",
    "Ternary expressions are supported.",
    "User-defined types (e.g., struct-s) are supported.",
    "Support for regular expressions.",
    "Support IP addresses.",
    "Include support for all builtin functions.",
    "Support interpreting MEL expressions.",
    "Fix bug in real MEL builtin type conversion function.",
    "Clean up formatting.",
    "Stylize output.",
    "Infrastructure changes to make deserializing results from Brooks safer.",
  ];
  return (
    <>
      <div className="changelog">
        <b>MEL Compiler Explorer Updates (from newest to oldest):</b>
        <ol>
          {items.reverse().map((v, i) => {
            return <li key={i}>{v}</li>;
          })}
        </ol>
        MEL Compiler Explorer Version: {MelCompilerVersion}
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <p>
        Use this <i>experimental</i>{" "}
        metadata expression language (MEL) compiler to explore the power of MEL.
        For more information about MEL, check out the{" "}
        <a href="https://datatracker.ietf.org/doc/draft-ietf-cdni-metadata-expression-language/">
          in-progress specification
        </a>. For more information about the implementation of the compiler
        deployed here, check out the{" "}
        <a href="https://github.com/cerfcast/brooks">source</a>!
      </p>
    </>
  );
}

interface CompilationResultProps {
  compilation_result?: string;
  interpret_result?: MelInterpretResult;
  error_result?: MelError;
  source: string;
}

function CompilationResult(
  { source, interpret_result, error_result, compilation_result }:
    CompilationResultProps,
) {
  if (error_result) {
    const location = error_result.location;
    let formatted_source = (
      <pre key="compilation-result-error-in-source">{source}</pre>
    );
    if (isSome(location)) {
      const pre = source.substring(0, location.start);
      const error = source.substring(
        location.start,
        location.start + location.extent,
      );
      const post = source.substring(location.start + location.extent);
      formatted_source = (
        <blockquote
          key="compilation-result-error-in-source"
          style={{ backgroundColor: "gainsboro" }}
        >
          <pre>
            {pre}
            <b>{error}</b>
            {post}
          </pre>
        </blockquote>
      );
    }
    return [
      <span key="compilation-result-error-source-code">
        <p>
          <b>Source Code:</b>
        </p>
        <code>{source}</code>
        <hr />
        <p>
          <b>Error:</b>
        </p>
      </span>,
      formatted_source,
      <p key="compilation-result-error-msg" style={{ whiteSpace: "pre-wrap" }}>
        {error_result.msg}
      </p>,
    ];
  } else if (compilation_result) {
    let interpret_result_html = (
      <span key="compilation-result-interpret-result"></span>
    );
    if (interpret_result) {
      interpret_result_html = (
        <span key="compilation-result-interpret-result">
          <p>
            <b>Interpreter Result:</b>
          </p>
          <ul>
            <li>
              <u>Value</u>: <code>{interpret_result.result}</code>
            </li>
            <li>
              <u>Type</u>: {orDefault(interpret_result.tpe, "")}
            </li>
          </ul>
        </span>
      );
    }
    return [
      <div key="compilation-result-source-code">
        <p>
          <b>Source Code:</b>
        </p>
        <code>{source}</code>
        <hr />
        <p>
          <b>AST:</b>
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {compilation_result}
        </p>
      </div>,
      interpret_result_html,
    ];
  }
}

function App() {
  const [compiled, setCompiled] = useState<string | undefined>(undefined);
  const [interpreted, setInterpreted] = useState<
    MelInterpretResult | undefined
  >(
    undefined,
  );
  const [error, setError] = useState<MelError | undefined>(undefined);
  const [compiledSource, setCompiledSource] = useState("");
  const [source, setSource] = useState("");
  const [request, setRequest] = useState(() => VirtualRequest.default());

  function compile(source: string) {
    setCompiledSource(source ? source.toString() : "");
    try {
      const result = compile_and_serialize(
        source ? source.toString() : "",
        request.jsonify(),
      );
      setCompiled(result[0]);

      const res = from<MelInterpretResult>(
        MelInterpretResult,
        JSON.parse(result[1]),
      );
      if (!isError(res)) {
        setInterpreted(res);
      } else {
        const x = new MelInterpretResult();
        x.tpe = None;
        x.result = `Internal error ${res.msg}`;
        setInterpreted(x);
      }

      setError(undefined);
    } catch (e) {
      const res = from<MelError>(MelError, JSON.parse((e as Error).message));
      if (!isError(res)) {
        setError(res);
      } else {
        const x = new MelError();
        x.msg = `Internal error: ${res.msg}`;
        x.location = None;
        setError(x);
      }
      setCompiled("");
      setInterpreted(undefined);
    }
  }

  return (
    <>
      <section>
        <div>
          <h1>MEL Compiler Explorer</h1>
          <About />
        </div>

        <div className="spacer" />
        <div className="double">
          <div className="left">
            <textarea
              cols={60}
              rows={10}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <br />
            <button
              type="submit"
              onClick={() => {
                compile(source);
              }}
            >
              Compile & Interpret
            </button>
            <br />
            <VirtualRequestBuilder
              request={request}
              update_request={setRequest}
            />
            <CompilationResult
              compilation_result={compiled}
              interpret_result={interpreted}
              error_result={error}
              source={compiledSource}
            />
          </div>
          <div className="right">
            <TryItOut source={setSource} compile={compile} />
          </div>
        </div>
        <div className="double">
          <Changelog />
        </div>
      </section>
    </>
  );
}

export default App;
