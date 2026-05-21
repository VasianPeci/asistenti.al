import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Chat from "./pages/Chat";
import Demo from "./pages/Demo";

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
