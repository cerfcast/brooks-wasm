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
//@deno-types="./../lib/brooks_lib.d.ts"
import { compile_and_serialize } from "./../lib/brooks_lib.js";
import { useState } from "react";

interface TryItOutProps {
  source: React.Dispatch<React.SetStateAction<string>>;
  compile: (a: string ) => void;
}

function TryItOut({ source, compile }: TryItOutProps) {
  const exprs = [
    ["5 + 3", ""],
    ['path_element("f", 2)', ""],
    ['path_element("f")', "Will Produce An Error"],
    ["5 + (8 + 2)", ""],
    ["true and false", ""],
    ["88 % 2", ""],
    ["boolean(5)", ""],
    ["boolean(\"hello\")", "Will Produce An Error"],
  ];
  return (
    <>
      <div className="try">
        <b>Try out these MEL expressions:</b>
        <ul>
          {exprs.map((v: Array<string>) => {
            return (
              <li>
                <a
                  href="#"
                  onClick={() => {
                    source(v[0]);
                    setTimeout(() => { compile(v[0])}, 1)
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
    "Updated examples."
  ];
  return (
    <>
      <div className="changelog">
        <b>MEL Compiler Explorer Updates:</b>
        <ol>
          {items.reverse().map((v) => {
            return (
              <>
                <li>{v}</li>
              </>
            );
          })}
        </ol>
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
  result: string;
  source: string;
}

function CompilationResult({ source, result }: CompilationResultProps) {
  if (result.length != 0) {
    return (
      <>
        <hr />
        <p>
          <b>Source Code:</b>
        </p>
        <code>{source}</code>
        <hr />
        <p>
          <b>AST:</b>
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {result}
        </p>
      </>
    );
  }
}

function App() {
  const [compiled, setCompiled] = useState("");
  const [compiledSource, setCompiledSource] = useState("");
  const [source, setSource] = useState("");

  function compile(source: string) {
    const result = compile_and_serialize(source ? source.toString() : "");
    setCompiledSource(source ? source.toString() : "");
    setCompiled(result);
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
            <button type="submit" onClick={() => { compile(source) }}>Compile</button>
            <CompilationResult result={compiled} source={compiledSource} />
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
