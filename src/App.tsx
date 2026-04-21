import { HashRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { SecurePostViewer } from "./components/postViewer";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/:cid" element={<SecurePostViewer />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
