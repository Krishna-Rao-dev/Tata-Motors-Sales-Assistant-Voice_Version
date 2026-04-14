import { KokoroTTS } from "kokoro-js";

const tts = await KokoroTTS.from_pretrained(
  "onnx-community/Kokoro-82M-v1.0-ONNX",
  { device: "cpu", dtype: "q8" } // q8 = quantized, smaller + faster
);
const british_male = ["am_adam", "am_michael", "am_echo"]
const american_male = ["bm_george", "bm_lewis", "bm_daniel", "bm_fable"]
const voices = [british_male, american_male]

// for (let i = 0; i < voices.length; i++) {
//   for (let j = 0; j < voices[i].length; j++) {
//     const audio = await tts.generate("Assuming a car on‑road price of ₹12,00,000, a 20% down payment of ₹2,40,000, a loan amount of ₹9,60,000, an interest rate of 9.5% per annum and a tenure of 60 months, the monthly EMI works out to about ₹20,300. The same loan for 36 months gives an EMI of roughly ₹31,000, while extending to 84 months reduces EMI to around ₹15,600.", {
//       voice: voices[i][j]
//     });
//     audio.save(voices[i][j] + "response.wav");
//   }
// }
const audio = await tts.generate("Assuming a car on‑road price of ₹12,00,000, a 20% down payment of ₹2,40,000, a loan amount of ₹9,60,000, an interest rate of 9.5% per annum and a tenure of 60 months, the monthly EMI works out to about ₹20,300. The same loan for 36 months gives an EMI of roughly ₹31,000, while extending to 84 months reduces EMI to around ₹15,600.", {
  voice: british_male[1],
  speed: 2,

});
audio.save("response.wav");