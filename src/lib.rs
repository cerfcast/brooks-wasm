use std::sync::Arc;

use wasm_bindgen::prelude::*;

use brooks_lib::{
    analysis::{MelAnalysisContext, MelOptimizer, MelTypeChecker},
    ast::{AstVisitorDriver, Type::{self, Function}},
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
