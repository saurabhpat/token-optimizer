let encoders = null;
let encoderPromise = null;
let hasFreedEncoders = false;

function getEncoder(modelId) {
  if (modelId?.includes("gpt-4o")) {
    return encoders.o200k;
  }

  return encoders.cl100k;
}

function releaseEncoders() {
  if (hasFreedEncoders || !encoders) {
    return;
  }

  Object.values(encoders).forEach((encoder) => {
    encoder.free();
  });

  hasFreedEncoders = true;
}

async function loadEncoders() {
  if (encoders) {
    return encoders;
  }

  if (!encoderPromise) {
    encoderPromise = Promise.all([
      import("tiktoken/lite"),
      import("tiktoken/encoders/o200k_base.json"),
      import("tiktoken/encoders/cl100k_base.json")
    ]).then(([{ Tiktoken }, { default: o200kBase }, { default: cl100kBase }]) => {
      encoders = {
        o200k: new Tiktoken(
          o200kBase.bpe_ranks,
          o200kBase.special_tokens,
          o200kBase.pat_str
        ),
        cl100k: new Tiktoken(
          cl100kBase.bpe_ranks,
          cl100kBase.special_tokens,
          cl100kBase.pat_str
        )
      };

      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", releaseEncoders, { once: true });
      }

      return encoders;
    });
  }

  return encoderPromise;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    releaseEncoders();
  });
}

export async function countTokens(text, modelId) {
  if (!text) {
    return 0;
  }

  await loadEncoders();
  const encoder = getEncoder(modelId);
  return encoder.encode(text).length;
}
