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

use std::{collections::HashMap, sync::Arc};

use wasm_bindgen::prelude::*;

use brooks_lib::{
    analysis::{MelAnalysisContext, MelOptimizer, MelTypeChecker},
    ast::{
        AstVisitorDriver, Struct,
        Type::{self, Function},
    },
    compiler::{CompilerError, MELCompilerContext, SyntaxError::EmptyContext, compile},
    expect_expr,
    serializer::{AstTextSerializer, AstTextSerializerContext},
};

#[wasm_bindgen]
pub fn compile_and_serialize(source: &str) -> std::result::Result<String, JsValue> {
    let compile_result = compile(source);
    let compiled = match compile_result {
        Ok(compiled) => compiled,
        Err(e) => return Ok(format!("Could not compile the expression: {e:?}")),
    };

    let ast = expect_expr!(compiled)
        .ok_or(CompilerError::SyntaxError(EmptyContext))
        .expect("Missing expected AST after compilation");

    let driver = AstVisitorDriver {};
    let visitor = MelTypeChecker {};
    let mut context = MelAnalysisContext::default();

    context = context.update_scopes(context.scopes.insert(
        "path_element",
        Function(Arc::new(Type::String), vec![Type::String, Type::Integer]),
    ));

    context = context.update_scopes(context.scopes.insert(
        "boolean",
        Function(Arc::new(Type::Boolean), vec![Type::Integer]),
    ));

    let mut uris = Struct {
        name: "Uri".to_string(),
        fields: HashMap::new(),
    };
    uris.fields.insert("path".to_string(), Type::String);
    uris.fields.insert("query".to_string(), Type::String);

    let mut reqs = Struct {
        name: "Req".to_string(),
        fields: HashMap::new(),
    };

    reqs.fields.insert("uri".to_string(), Type::Struct(uris));
    context = context.update_scopes(context.scopes.insert("req", Type::Struct(reqs)));

    let result = match driver.visit(&ast, &visitor, context) {
        Ok(result) => result,
        Err(e) => return Ok(format!("Type Error: {e}")),
    };

    let driver = AstVisitorDriver {};
    let visitor = MelOptimizer {};
    let result = driver
        .visit(&ast, &visitor, result)
        .expect("Could not optimize the expression");

    let result = match result.expr {
        Some(e) => e,
        None => return Ok("Could not analyze expression.".into()),
    };

    let driver = AstVisitorDriver {};
    let visitor = AstTextSerializer {};
    let context = AstTextSerializerContext {
        serialized: "".to_string(),
        indent: 0,
    };
    let result = driver
        .visit(&result, &visitor, context)
        .expect("Could not serialize");

    Ok(result.serialized)
}
