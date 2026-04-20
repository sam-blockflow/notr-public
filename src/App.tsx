import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { SecurePostViewer } from "./components/postViewer";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:cid" element={<SecurePostViewer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
