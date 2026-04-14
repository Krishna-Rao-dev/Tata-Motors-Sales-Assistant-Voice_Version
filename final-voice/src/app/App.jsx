import { BrowserRouter, Routes, Route } from "react-router";
import { VoiceAssistant } from "./components/VoiceAssistant";
import Selectvoice from "./components/Selectvoice";

export default function App() {
  return (
    <BrowserRouter>
      <div className="size-full bg-black">
        <Routes>
          <Route path="/" element={<Selectvoice />} />
          <Route path="/main" element={<VoiceAssistant />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
