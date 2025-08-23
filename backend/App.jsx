import React, { useState, useEffect } from "react";
import { FiSend, FiRefreshCw, FiCheckCircle, FiXCircle, FiLink, FiUsers, FiCopy, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs";

const apiBase = "http://localhost:3001/api";

function Login({ onLogin }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${apiBase}/validate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      setLoading(false);
      if (data.valid) {
        localStorage.setItem("accessToken", token);
        onLogin(token);
      } else {
        setError("Token inválido!");
      }
    } catch (err) {
      setLoading(false);
      setError("Erro ao conectar à API.");
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

function App() {
  const [token, setToken] = useState(localStorage.getItem("accessToken") || "");
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState("loading");
  const [number, setNumber] = useState("");
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [webhook, setWebhook] = useState("");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch status and QR
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/qr`);
      const data = await resp.json();
      setStatus(data.status);
      setQr(data.qr || null);
    } catch (err) {
      setStatus("error");
    }
    setLoading(false);
  };

  // Fetch messages with token
  const fetchMessages = async () => {
    try {
      const resp = await fetch(`${apiBase}/messages`, {
        method: "GET",
        headers: {
          "x-access-token": localStorage.getItem("accessToken"),
        },
      });
      const data = await resp.json();
      if (Array.isArray(data)) {
        setMessages(data);
        setContacts([...new Set(data.map(m => m.from))]);
      } else {
        setMessages([]);
        setContacts([]);
        toast.error(data.error || "Erro ao carregar mensagens");
      }
    } catch (err) {
      setMessages([]);
      setContacts([]);
      toast.error("Erro ao conectar à API");
    }
  };

  useEffect(() => {
    fetchStatus();
    if (token) {
      fetchMessages();
      const interval = setInterval(() => {
        fetchStatus();
        fetchMessages();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (bulkMode) {
      let nums = bulkNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(n => n);
      if (!nums.length || !message) {
        toast.error("Preencha os números e a mensagem!");
        return;
      }
      let success = 0, fail = 0;
      for (let n of nums) {
        try {
          const resp = await fetch(`${apiBase}/message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-access-token": localStorage.getItem("accessToken"),
            },
            body: JSON.stringify({ number: n, message }),
          });
          const res = await resp.json();
          if (res.status) success++;
          else fail++;
        } catch {
          fail++;
        }
      }
      toast.success(`Enviadas: ${success} | Falhou: ${fail}`);
      setMessage("");
      setBulkNumbers("");
      fetchMessages();
    } else {
      if (!number || !message) {
        toast.error("Preencha número e mensagem!");
        return;
      }
      try {
        const resp = await fetch(`${apiBase}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-token": localStorage.getItem("accessToken"),
          },
          body: JSON.stringify({ number, message }),
        });
        const res = await resp.json();
        if (res.status) {
          toast.success("Mensagem enviada!");
          setMessage("");
          fetchMessages();
        } else {
          toast.error(res.error || "Erro ao enviar.");
        }
      } catch (err) {
        toast.error("Falha ao conectar à API.");
      }
    }
  };

  // Reconnect
  const handleReconnect = async () => {
    try {
      await fetch(`${apiBase}/reconnect`, {
        method: "POST",
        headers: { "x-access-token": localStorage.getItem("accessToken") },
      });
      fetchStatus();
      toast.info("Reconectando...");
    } catch (err) {
      toast.error("Falha ao tentar reconectar");
    }
  };

  // Registrar Webhook
  const handleSetWebhook = async () => {
    if (!webhook) {
      toast.error("Informe a URL do webhook.");
      return;
    }
    try {
      await fetch(`${apiBase}/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": localStorage.getItem("accessToken"),
        },
        body: JSON.stringify({ url: webhook }),
      });
      toast.success("Webhook registrado.");
    } catch (err) {
      toast.error("Falha ao registrar webhook.");
    }
  };

  // Envio de mídia (imagem)
  const handleSendMedia = async (e) => {
    const file = e.target.files[0];
    if (!file || !(bulkMode ? bulkNumbers : number)) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (bulkMode) {
          let nums = bulkNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(n => n);
          let success = 0, fail = 0;
          for (let n of nums) {
            await fetch(`${apiBase}/media`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-access-token": localStorage.getItem("accessToken"),
              },
              body: JSON.stringify({
                number: n,
                caption: message,
                mediaUrl: reader.result,
              }),
            });
            success++;
          }
          toast.success(`Mídia enviada para ${success} números.`);
        } else {
          await fetch(`${apiBase}/media`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-access-token": localStorage.getItem("accessToken"),
            },
            body: JSON.stringify({
              number,
              caption: message,
              mediaUrl: reader.result,
            }),
          });
          toast.success("Mídia enviada!");
        }
      } catch {
        toast.error("Erro ao enviar mídia.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Filtragem de mensagens
  const filteredMessages = Array.isArray(messages)
    ? (search
        ? messages.filter(
            m =>
              m.body?.toLowerCase().includes(search.toLowerCase()) ||
              m.from?.toLowerCase().includes(search.toLowerCase())
          )
        : messages)
    : [];

  // Cópia do número do contato
  const handleCopyContact = c => {
    navigator.clipboard.writeText(c);
    toast.info("Contato copiado!");
  };

  // Clique em contato preenche número/bulk
  const handleContactClick = c => {
    if (bulkMode) {
      setBulkNumbers(bulkNumbers ? bulkNumbers + "\n" + c : c);
    } else {
      setNumber(c);
    }
    toast.success("Contato preenchido!");
  };

  // Drawer style
  const drawerWidth = drawerOpen ? "w-64" : "w-16";

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    setToken("");
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 flex flex-col">
      <ToastContainer position="top-right" autoClose={3500} />

      {/* Header */}
      <header className="bg-gray-950 text-white flex items-center px-8 py-4 shadow-lg">
        <FiUsers className="text-3xl mr-2 text-blue-500" />
        <h1 className="text-2xl font-bold tracking-wide">WhatsApp API Dashboard</h1>
        <span className="ml-auto flex items-center gap-2">
          {status === "authenticated" ? (
            <FiCheckCircle className="mr-2 text-green-500" />
          ) : (
            <FiXCircle className="mr-2 text-red-500 animate-pulse" />
          )}
          <span className={`font-semibold ${status === "authenticated" ? "text-green-400" : "text-red-400"}`}>
            {status === "authenticated" ? "Conectado" : status === "scan" ? "Escaneie o QR" : "Carregando..."}
          </span>
          <button onClick={handleReconnect} className="ml-6 px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-white font-bold flex items-center">
            <FiRefreshCw className="mr-1" /> Reconectar
          </button>
          <button onClick={handleLogout} className="px-3 py-1 bg-gray-700 hover:bg-gray-800 rounded text-white font-bold flex items-center">
            Sair
          </button>
        </span>
      </header>

      <div className="flex flex-row flex-grow relative">
        {/* Main grid */}
        <main className={`flex-grow grid grid-cols-1 md:grid-cols-3 gap-8 py-8 px-4 md:px-12 transition-all`}>
          {/* Autenticação */}
          <section className="bg-gray-900 rounded-xl shadow-lg p-6 flex flex-col items-center justify-center min-h-[350px]">
            <h2 className="text-lg font-bold mb-2 text-white">Autenticação</h2>
            {qr && status === "scan" ? (
              <>
                <img src={qr} alt="QR Code" className="w-48 h-48 border mb-3" />
                <span className="text-gray-300 text-sm">Escaneie para conectar</span>
              </>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-gray-500">
                {loading ? (
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                ) : (
                  <FiCheckCircle className="text-5xl text-green-600" />
                )}
              </div>
            )}
          </section>

          {/* Envio de mensagem / mídia */}
          <section className="bg-gray-900 rounded-xl shadow-lg p-6 flex flex-col min-h-[350px]">
            <h2 className="text-lg font-bold mb-2 text-white">Enviar Mensagem</h2>
            <div className="flex items-center mb-2">
              <label className="text-white font-semibold mr-2">
                <input type="checkbox" checked={bulkMode} onChange={() => setBulkMode(!bulkMode)} className="mr-1" />
                Bulk
              </label>
              <span className="text-xs text-gray-400">Envie para vários números</span>
            </div>
            {bulkMode ? (
              <textarea
                rows={4}
                placeholder="Cole os números separados por linha, vírgula ou ponto e vírgula"
                className="w-full px-2 py-1 rounded mb-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400"
                value={bulkNumbers}
                onChange={e => setBulkNumbers(e.target.value)}
              />
            ) : (
              <input
                type="text"
                placeholder="Número (ex: 5511999999999)"
                className="w-full px-2 py-1 rounded mb-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400"
                value={number}
                onChange={e => setNumber(e.target.value)}
              />
            )}
            <textarea
              placeholder="Mensagem"
              className="w-full px-2 py-1 rounded mb-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <button onClick={handleSendMessage} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold flex items-center justify-center mb-2">
              <FiSend className="mr-1" /> {bulkMode ? "Enviar em Massa" : "Enviar Mensagem"}
            </button>
            <label className="flex items-center text-white font-semibold cursor-pointer mb-2">
              <input type="file" accept="image/*" className="hidden" onChange={handleSendMedia} />
              <span className="bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded flex items-center">
                <FiLink className="mr-1" /> Enviar Imagem {bulkMode ? "em Massa" : ""}
              </span>
            </label>
            <div className="mt-2">
              <input
                type="text"
                placeholder="Webhook URL"
                className="w-full px-2 py-1 rounded border border-gray-700 bg-gray-800 text-white placeholder-gray-400"
                value={webhook}
                onChange={e => setWebhook(e.target.value)}
              />
              <button onClick={handleSetWebhook} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold w-full flex items-center justify-center">
                <FiLink className="mr-1" /> Registrar Webhook
              </button>
            </div>
          </section>

          {/* Mensagens Recentes */}
          <section className="bg-gray-900 rounded-xl shadow-lg p-6 flex flex-col min-h-[350px]">
            <h2 className="text-lg font-bold mb-2 text-white">Mensagens Recentes</h2>
            <div className="flex flex-row gap-2 mb-2">
              <input
                type="text"
                placeholder="Buscar mensagem..."
                className="flex-1 px-2 py-1 rounded border border-gray-700 bg-gray-800 text-white placeholder-gray-400"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="text-gray-400">Total: {filteredMessages.length}</span>
            </div>
            <div className="max-h-56 overflow-auto">
              {filteredMessages.length === 0 ? (
                <div className="text-gray-400 italic">Nenhuma mensagem recebida.</div>
              ) : (
                <ul>
                  {filteredMessages.map((m, i) => (
                    <li key={i} className="mb-2 border-b border-gray-700 pb-2">
                      <span className="font-mono text-xs text-blue-400">{m.from}</span>
                      <span className="text-gray-400 ml-2">{dayjs(m.timestamp).format("DD/MM HH:mm")}</span>
                      <br />
                      <span className="text-white break-words">{m.body}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>

        {/* Drawer de contatos recentes */}
        <aside className={`transition-all duration-300 bg-gray-800 text-white shadow-xl h-full flex flex-col ${drawerWidth} absolute right-0 top-0 z-30`}>
          <button className="absolute left-[-1.5rem] top-8 bg-gray-800 rounded-r-xl p-1 text-white flex items-center shadow-md"
                  onClick={() => setDrawerOpen(!drawerOpen)}>
            {drawerOpen ? <FiChevronRight size={24}/> : <FiChevronLeft size={24}/>}
          </button>
          <div className={drawerOpen ? "px-6 pt-8" : "px-2 pt-8"}>
            <h2 className={`font-bold mb-4 text-lg ${drawerOpen ? "" : "hidden"}`}>Contatos Recentes</h2>
            <ul>
              {contacts.length === 0 ? (
                <li className="text-gray-400">Nenhum contato.</li>
              ) : (
                contacts.map((c, i) => (
                  <li key={i} className={`mb-2 flex items-center group cursor-pointer ${drawerOpen ? "" : "justify-center"}`}
                      onClick={() => handleContactClick(c)}>
                    <span className={`${drawerOpen ? "group-hover:underline" : "truncate w-10 text-xs"}`}>{drawerOpen ? c : c.slice(0, 8) + "..."}</span>
                    <FiCopy className={`ml-2 cursor-pointer group-hover:text-blue-400 ${drawerOpen ? "" : "hidden"}`} onClick={e => {e.stopPropagation();handleCopyContact(c);}} />
                  </li>
                ))
              )}
            </ul>
            <div className={`mt-8 text-xs text-gray-400 ${drawerOpen ? "" : "hidden"}`}>Uptime: {(performance.now()/1000/60).toFixed(1)} min</div>
          </div>
        </aside>
      </div>
      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-sm py-6 px-8 mt-8">
        Desenvolvido por você com <span className="text-red-500">❤</span> — {dayjs().format("YYYY")}
      </footer>
    </div>
  );
}

export default App;