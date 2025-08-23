import React, { useState } from "react";

function Login({ onLogin }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const resp = await fetch("http://localhost:3001/api/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await resp.json();
    setLoading(false);
    if (data.valid) {
      localStorage.setItem("accessToken", token);
      onLogin(token);
    } else {
      setError("Token inválido!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800">
      <div className="bg-gray-900 rounded-xl shadow-lg p-8 w-96 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-white mb-4">Acesso Restrito</h1>
        <input
          type="text"
          placeholder="Digite seu token de acesso"
          className="w-full px-3 py-2 rounded border border-gray-700 bg-gray-800 text-white mb-4"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold w-full"
          disabled={loading}
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
        {error && <span className="text-red-500 mt-2">{error}</span>}
      </div>
    </div>
  );
}

export default Login;