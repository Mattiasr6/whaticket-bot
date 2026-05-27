import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  makeStyles,
  Typography,
  Paper,
  CircularProgress,
} from "@material-ui/core";
import { Send, Close } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  chatContainer: {
    height: 400,
    overflowY: "auto",
    padding: theme.spacing(2),
    backgroundColor: "#e5ddd5",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    color: "#000000",
    borderRadius: "8px 8px 8px 0",
    padding: theme.spacing(1, 2),
    maxWidth: "80%",
    wordBreak: "break-word",
    boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
    whiteSpace: "pre-wrap",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#dcf8c6",
    color: "#000000",
    borderRadius: "8px 8px 0 8px",
    padding: theme.spacing(1, 2),
    maxWidth: "80%",
    wordBreak: "break-word",
    boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
    whiteSpace: "pre-wrap",
  },
  inputArea: {
    display: "flex",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    alignItems: "center",
  },
  statusText: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: theme.spacing(1),
  },
  emptyChat: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: theme.palette.text.secondary,
    flexDirection: "column",
    gap: theme.spacing(1),
  },
}));

const FlowBotPreview = ({ open, onClose, botId }) => {
  const classes = useStyles();
  const chatRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, botId]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return;

    if (text.trim() === "#") {
      setCurrentNodeId(null);
    }

    const userMsg = { role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post(`/flow-bots/${botId}/preview`, {
        message: text.trim(),
        currentNodeId,
      });

      if (data && data.finalNodeId !== undefined) {
        setCurrentNodeId(data.finalNodeId);
      }

      const replies = Array.isArray(data.replies) ? data.replies : [];

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          ...replies.map((replyText) => ({
            role: "bot",
            text: replyText,
          })),
        ]);
        setSending(false);
      }, 500);
    } catch (err) {
      toastError(err);
      setSending(false);
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Probar Bot</span>
        <IconButton size="small" onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers style={{ padding: 0 }}>
        <div className={classes.chatContainer} ref={chatRef}>
          {messages.length === 0 && !sending && (
            <div className={classes.emptyChat}>
              <Typography variant="body2">
                Iniciando conversación...
              </Typography>
              <CircularProgress size={20} />
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={
                msg.role === "bot" ? classes.bubbleBot : classes.bubbleUser
              }
            >
              {msg.text}
              {msg.options && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                  Opciones: {msg.options.join(", ")}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className={classes.bubbleBot} style={{ backgroundColor: "#f0f0f0" }}>
              <CircularProgress size={16} />
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions style={{ padding: "8px 16px" }}>
        <div className={classes.inputArea} style={{ width: "100%" }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Escribe un mensaje..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            autoFocus
          />
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{ minWidth: 40 }}
          >
            <Send fontSize="small" />
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBotPreview;
