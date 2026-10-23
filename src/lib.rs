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

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use brooks_lib::{
    environment::scope::Scope,
    mel::{
        self,
        analysis::{MelAnalysisContext, MelOptimizer, MelTypeChecker},
        ast::AstVisitorDriver,
        interpreter::{
            builtins::builtin_builtin_function_interpreters, interpret::MelInterpContext,
            values::TypedValue,
        },
        scope::builtin_function_types,
        serializer::{AstTextSerializer, AstTextSerializerContext},
    },
};

#[derive(Debug, Clone, Deserialize)]
struct VirtualRequestHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
struct VirtualRequest {
    pub method: String,
    pub uri: String,
    pub headers: Vec<VirtualRequestHeader>,
}

impl TryFrom<VirtualRequest> for http::Request<Vec<u8>> {
    type Error = std::io::Error;

    fn try_from(value: VirtualRequest) -> Result<Self, Self::Error> {
        let mut req = http::request::Builder::new();

        req = req.method(if value.method == "GET" {
            http::method::Method::GET
        } else if value.method == "POST" {
            http::method::Method::POST
        } else {
            return Err(std::io::Error::other("Invalid method"));
        });

        for vrh in value.headers {
            req = req.header(vrh.name, vrh.value)
        }

        req = req.uri(value.uri);
        req.body(vec![]).map_err(std::io::Error::other)
    }
}

#[derive(Serialize)]
struct InterpretResult {
    result: String,
    tpe: String,
}

#[derive(Serialize)]
struct InterpretErrorLocation {
    start: usize,
    extent: usize,
}

#[derive(Serialize)]
struct InterpretError {
    msg: String,
    location: InterpretErrorLocation,
}

#[wasm_bindgen]
pub fn compile_and_serialize(
    source: &str,
    request: &str,
) -> std::result::Result<Vec<String>, JsValue> {
    let virtual_request =
        serde_json::from_str::<VirtualRequest>(request).expect("Could not deserialize a request");

    let request: http::Request<Vec<u8>> = virtual_request.try_into().map_err(|e| {
        JsError::new(&format!(
            "Could not generate request from virtual request: {e}"
        ))
    })?;

    let compiled = mel::compiler::compile(source).map_err(|e| {
        JsError::new(
            &serde_json::to_string(&InterpretError {
                msg: (e.error).to_string(),
                location: InterpretErrorLocation {
                    start: e.location.start,
                    extent: e.location.extent,
                },
            })
            .expect("Could not serialize error"),
        )
    })?;

    let driver = AstVisitorDriver {};
    let visitor = MelTypeChecker {};
    let mut context = MelAnalysisContext::default();

    context = context.update_scopes(&(&builtin_function_types() + &request.clone().into()).into());

    let result = driver.visit(&compiled, &visitor, context).map_err(|e| {
        JsError::new(
            &serde_json::to_string(&InterpretError {
                msg: (e.error).to_string(),
                location: InterpretErrorLocation {
                    start: e.location.start,
                    extent: e.location.extent,
                },
            })
            .expect("Could not serialize error"),
        )
    })?;

    let driver = AstVisitorDriver {};
    let visitor = MelOptimizer {};
    let result = driver.visit(&compiled, &visitor, result);

    let result = result.map_err(|e| {
        JsError::new(
            &serde_json::to_string(&InterpretError {
                msg: (e.error).to_string(),
                location: InterpretErrorLocation {
                    start: e.location.start,
                    extent: e.location.extent,
                },
            })
            .expect("Could not serialize error"),
        )
    })?;

    let result = result.expr.ok_or(JsError::new(
        &serde_json::to_string(&InterpretError {
            msg: "Could not analyze expression: No analyzed expression produced.".to_string(),
            location: InterpretErrorLocation {
                start: 0,
                extent: 0,
            },
        })
        .expect("Could not serialize error"),
    ))?;

    let mut interp_context = MelInterpContext::default();
    interp_context = interp_context.update_scopes(
        &(&builtin_builtin_function_interpreters()
            + &(TryInto::<Scope<TypedValue>>::try_into(request).expect("TODO")))
            .into(),
    );

    let interpret_res = mel::interpreter::interpret(&result, interp_context).map_err(|e| {
        JsError::new(
            &serde_json::to_string(&InterpretError {
                msg: (e.error).to_string(),
                location: InterpretErrorLocation {
                    start: e.location.start,
                    extent: e.location.extent,
                },
            })
            .expect("Could not serialize error"),
        )
    })?;

    let pretty_interpreter_res = match interpret_res.val {
        Some(v) => InterpretResult {
            result: v.to_string(),
            tpe: v.tpe.to_string(),
        },
        None => InterpretResult {
            result: "No value generated.".to_string(),
            tpe: "".to_string(),
        },
    };

    let driver = AstVisitorDriver {};
    let visitor = AstTextSerializer {};
    let context = AstTextSerializerContext {
        serialized: "".to_string(),
        indent: 0,
    };

    let result = driver.visit(&result, &visitor, context).map_err(|_| {
        JsError::new(
            &serde_json::to_string(&InterpretError {
                msg: "Could not serialize the AST".to_string(),
                location: InterpretErrorLocation {
                    start: 0,
                    extent: 0,
                },
            })
            .expect("Could not serialize error"),
        )
    })?;

    Ok(vec![
        result.serialized,
        serde_json::to_string(&pretty_interpreter_res).expect("Could not serialize the result."),
    ])
}
