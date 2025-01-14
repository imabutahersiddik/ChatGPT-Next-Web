import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX } from "../constant";
import { DiscussServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isPaLMApiKey = token.startsWith("AIza");

  return {
    apiKey: isPaLMApiKey ? token : "",
  };
}

export async function auth(req: NextRequest) {
  const authToken = req.headers.get("Authorization") ?? "";

  // check if it is PaLM api key or user token
  const { apiKey: token } = parseApiKey(authToken);

  const serverConfig = getServerSideConfig();
  console.log("[Auth] got PaLM api key:", token);
  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());

  // if user does not provide an api key, inject system api key
  if (!token) {
    const apiKey = serverConfig.palmApiKey;
    if (apiKey) {
      console.log("[Auth] use system api key");
      req.headers.set("Authorization", `Bearer ${apiKey}`);
    } else {
      console.log("[Auth] admin did not provide an api key");
    }
  } else {
    console.log("[Auth] use user api key");
  }

  // check if the api key is valid
  if (token) {
    const client = new DiscussServiceClient({
      authClient: new GoogleAuth().fromAPIKey(token),
    });

    try {
      const result = await client.generateMessage({
        model: "models/chat-bison-001",
        temperature: 0.5,
        candidateCount: 1,
        prompt: {
          messages: [{ content: "Hello" }],
        },
      });

      console.log("[Auth] PaLM API key is valid");
    } catch (error) {
      console.log("[Auth] PaLM API key is invalid");
      return {
        error: true,
        msg: "invalid PaLM api key",
      };
    }
  }

  return {
    error: false,
  };
}
