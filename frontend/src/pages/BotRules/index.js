import React, { useState, useEffect, useContext } from "react";
import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tooltip,
  Chip
} from "@material-ui/core";
import { Edit, DeleteOutline } from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    minWidth: 450,
  },
}));

const BotRules = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    whatsappId: "",
    name: "",
    keywords: "",
    matchType: "contains",
    response: "",
    mediaPath: "",
    mediaName: "",
    scope: "all",
    groupJid: "",
    enabled: true,
    priority: 0,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bot-rules");
      setRules(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      whatsappId: whatsApps.length > 0 ? whatsApps[0].id : "",
      name: "",
      keywords: "",
      matchType: "contains",
      response: "",
      mediaPath: "",
      mediaName: "",
      scope: "all",
      groupJid: "",
      enabled: true,
      priority: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      whatsappId: rule.whatsappId,
      name: rule.name,
      keywords: rule.keywords,
      matchType: rule.matchType,
      response: rule.response || "",
      mediaPath: rule.mediaPath || "",
      mediaName: rule.mediaName || "",
      scope: rule.scope,
      groupJid: rule.groupJid || "",
      enabled: rule.enabled,
      priority: rule.priority,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.keywords) {
      toast.warn("Rule name and keywords are required");
      return;
    }
    try {
      if (editing) {
        await api.put(`/bot-rules/${editing.id}`, form);
        toast.success("Rule updated");
      } else {
        await api.post("/bot-rules", form);
        toast.success("Rule created");
      }
      setModalOpen(false);
      fetchRules();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/bot-rules/${deleting.id}`);
      toast.success("Rule deleted");
      setConfirmOpen(false);
      setDeleting(null);
      fetchRules();
    } catch (err) {
      toastError(err);
    }
  };

  const scopeLabel = (scope) => {
    switch (scope) {
      case "all": return "All";
      case "group": return "Groups Only";
      case "chat": return "Individual Only";
      default: return scope;
    }
  };

  const matchLabel = (type) => {
    switch (type) {
      case "contains": return "Contains";
      case "exact": return "Exact";
      case "regex": return "Regex";
      case "all": return "All Keywords";
      default: return type;
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Delete "${deleting?.name || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        This will permanently remove the bot rule.
      </ConfirmationModal>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md">
        <DialogTitle>
          {editing ? "Edit Bot Rule" : "New Bot Rule"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <FormControl fullWidth margin="dense">
              <InputLabel>WhatsApp Connection</InputLabel>
              <Select
                value={form.whatsappId}
                onChange={(e) =>
                  setForm({ ...form, whatsappId: e.target.value })
                }
              >
                {whatsApps.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Rule Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              margin="dense"
            />

            <TextField
              label="Keywords (one per line)"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              fullWidth
              multiline
              rows={4}
              margin="dense"
              placeholder="precio&#10;cuanto cuesta&#10;valor"
            />

            <FormControl fullWidth margin="dense">
              <InputLabel>Match Type</InputLabel>
              <Select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value })}
              >
                <MenuItem value="contains">Contains (message contains any keyword)</MenuItem>
                <MenuItem value="exact">Exact (message equals a keyword)</MenuItem>
                <MenuItem value="all">All Keywords (message contains ALL keywords)</MenuItem>
                <MenuItem value="regex">Regex (keywords is a regex pattern)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel>Scope</InputLabel>
              <Select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                <MenuItem value="all">All Chats</MenuItem>
                <MenuItem value="group">Groups Only</MenuItem>
                <MenuItem value="chat">Individual Chats Only</MenuItem>
              </Select>
            </FormControl>

            {form.scope === "group" && (
              <TextField
                label="Specific Group JID (optional, leave blank for all groups)"
                value={form.groupJid}
                onChange={(e) => setForm({ ...form, groupJid: e.target.value })}
                fullWidth
                margin="dense"
                placeholder="e.g. 1234567890-123456@g.us"
              />
            )}

            <TextField
              label="Bot Response (text)"
              value={form.response}
              onChange={(e) => setForm({ ...form, response: e.target.value })}
              fullWidth
              multiline
              rows={3}
              margin="dense"
            />

            <TextField
              label="Media filename (in public/ folder)"
              value={form.mediaPath}
              onChange={(e) =>
                setForm({ ...form, mediaPath: e.target.value, mediaName: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="e.g. mi-qr.png"
            />

            <TextField
              label="Priority (lower = executed first)"
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              fullWidth
              margin="dense"
              inputProps={{ min: 0, max: 999 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Bot Rules</Title>
        <MainHeaderButtonsWrapper>
          <Button variant="contained" color="primary" onClick={openCreate}>
            Add Bot Rule
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">Keywords</TableCell>
              <TableCell align="center">Match</TableCell>
              <TableCell align="center">Scope</TableCell>
              <TableCell align="center">Response</TableCell>
              <TableCell align="center">Priority</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell align="center">{rule.name}</TableCell>
                <TableCell align="center">
                  {rule.keywords.split("\n").slice(0, 2).map((kw, i) => (
                    <Chip key={i} label={kw.trim()} size="small" style={{ margin: 1 }} />
                  ))}
                  {rule.keywords.split("\n").length > 2 && "..."}
                </TableCell>
                <TableCell align="center">
                  <Chip label={matchLabel(rule.matchType)} size="small" />
                </TableCell>
                <TableCell align="center">{scopeLabel(rule.scope)}</TableCell>
                <TableCell align="center" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {rule.response?.substring(0, 40) || (rule.mediaName || "-")}
                </TableCell>
                <TableCell align="center">{rule.priority}</TableCell>
                <TableCell align="center">
                  <Tooltip title={rule.enabled ? "Active" : "Disabled"}>
                    <span style={{ color: rule.enabled ? "green" : "gray" }}>
                      {rule.enabled ? "ON" : "OFF"}
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(rule)}>
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleting(rule);
                      setConfirmOpen(true);
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={8} />}
            {!loading && rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No bot rules yet. Click "Add Bot Rule" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default BotRules;
