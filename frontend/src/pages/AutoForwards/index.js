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
  Chip,
  Typography,
  FormHelperText,
  CircularProgress,
} from "@material-ui/core";
import { Edit, DeleteOutline, Forward, ListAlt } from "@material-ui/icons";

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
    minWidth: 520,
  },
  chipSuccess: {
    backgroundColor: "#4caf50",
    color: "#fff",
  },
  chipWarning: {
    backgroundColor: "#ff9800",
    color: "#fff",
  },
  chipError: {
    backgroundColor: "#f44336",
    color: "#fff",
  },
  chipDefault: {
    backgroundColor: "#9e9e9e",
    color: "#fff",
  },
  groupSelectLoading: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(2),
  },
}));

const STATUS_CHIP_CLASSES = {
  success: "chipSuccess",
  no_images: "chipWarning",
  cancelled: "chipDefault",
  error: "chipError",
};

const STATUS_LABELS = {
  success: "Success",
  no_images: "No Images",
  cancelled: "Cancelled",
  error: "Error",
};

const AutoForwards = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsRuleName, setLogsRuleName] = useState("");

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [groupNames, setGroupNames] = useState({});

  const initialForm = {
    name: "",
    whatsappId: "",
    sourceGroupJid: "",
    targetGroupJid: "",
    adminNumbers: "",
    timeWindowMinutes: 10,
    maxForward: 15,
    customCaption: "",
    delayBetweenMs: 4000,
    enabled: true,
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    if (form.whatsappId && (modalOpen || form.whatsappId !== "")) {
      fetchGroups(form.whatsappId);
    } else {
      setGroups([]);
    }
  }, [form.whatsappId]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auto-forwards");
      const rulesList = Array.isArray(data) ? data : [];
      setRules(rulesList);

      // Build group name map from all unique whatsappIds
      const uniqueIds = [...new Set(rulesList.map((r) => r.whatsappId).filter(Boolean))];
      const nameMap = {};
      await Promise.all(
        uniqueIds.map(async (wid) => {
          try {
            const { data: grps } = await api.get(`/whatsapp/${wid}/groups`);
            if (Array.isArray(grps)) {
              grps.forEach((g) => {
                const key = g.jid || g.id;
                if (key) nameMap[key] = g.name || g.subject || key;
              });
            }
          } catch (_) {
            // group fetch failed, skip
          }
        })
      );
      setGroupNames(nameMap);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const fetchGroups = async (whatsappId) => {
    if (!whatsappId) return;
    setGroupsLoading(true);
    setGroupsError(false);
    try {
      const { data } = await api.get(`/whatsapp/${whatsappId}/groups`);
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setGroupsError(true);
      setGroups([]);
    }
    setGroupsLoading(false);
  };

  const fetchLogs = async (rule) => {
    setLogsLoading(true);
    setLogsRuleName(rule.name);
    try {
      const { data } = await api.get(`/auto-forwards/${rule.id}/logs`);
      setLogsData(Array.isArray(data) ? data : []);
      setLogsOpen(true);
    } catch (err) {
      toastError(err);
    }
    setLogsLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...initialForm,
      whatsappId: whatsApps.length > 0 ? whatsApps[0].id : "",
    });
    setGroups([]);
    setModalOpen(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      whatsappId: rule.whatsappId || "",
      sourceGroupJid: rule.sourceGroupJid || "",
      targetGroupJid: rule.targetGroupJid || "",
      adminNumbers: rule.adminNumbers || "",
      timeWindowMinutes: rule.timeWindowMinutes ?? 10,
      maxForward: rule.maxForward ?? 15,
      customCaption: rule.customCaption || "",
      delayBetweenMs: rule.delayBetweenMs ?? 4000,
      enabled: rule.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !/^[a-zA-Z0-9\-]+$/.test(form.name)) {
      toast.warn("Name must be slug format (letters, numbers, hyphens only)");
      return;
    }
    if (!form.whatsappId) {
      toast.warn("WhatsApp connection is required");
      return;
    }
    if (!form.sourceGroupJid) {
      toast.warn("Source group is required");
      return;
    }
    if (!form.targetGroupJid) {
      toast.warn("Target group is required");
      return;
    }
    if (form.sourceGroupJid === form.targetGroupJid) {
      toast.warn("Source and target groups must be different");
      return;
    }
    if (!form.adminNumbers.trim()) {
      toast.warn("At least one admin number is required");
      return;
    }

    const payload = {
      ...form,
      whatsappId: Number(form.whatsappId),
      timeWindowMinutes: Number(form.timeWindowMinutes),
      maxForward: Number(form.maxForward),
      delayBetweenMs: Number(form.delayBetweenMs),
    };

    try {
      if (editing) {
        await api.put(`/auto-forwards/${editing.id}`, payload);
        toast.success("Rule updated");
      } else {
        await api.post("/auto-forwards", payload);
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
      await api.delete(`/auto-forwards/${deleting.id}`);
      toast.success("Rule deleted");
      setConfirmOpen(false);
      setDeleting(null);
      fetchRules();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await api.put(`/auto-forwards/${rule.id}/toggle`);
      fetchRules();
    } catch (err) {
      toastError(err);
    }
  };

  const formatAdminNumbers = (numbers) => {
    if (!numbers) return "-";
    const list = numbers.split("\n").filter((n) => n.trim());
    return list.length === 1
      ? list[0]
      : `${list[0]} +${list.length - 1} more`;
  };

  const getGroupName = (jid) => {
    if (!jid) return "-";
    return groupNames[jid] || jid;
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Delete "${deleting?.name || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        This will permanently remove the auto-forward rule.
      </ConfirmationModal>

      {/* CRUD Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editing ? "Edit Auto Forward" : "New Auto Forward"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <TextField
              label="Rule Name (slug)"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="my-forward-rule"
              helperText="Only letters, numbers, and hyphens"
            />

            <FormControl fullWidth margin="dense">
              <InputLabel>WhatsApp Connection</InputLabel>
              <Select
                value={form.whatsappId}
                onChange={(e) => {
                  setForm({
                    ...form,
                    whatsappId: e.target.value,
                    sourceGroupJid: "",
                    targetGroupJid: "",
                  });
                }}
              >
                {whatsApps.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Source Group */}
            {groupsLoading ? (
              <div className={classes.groupSelectLoading}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="textSecondary">
                  Loading groups...
                </Typography>
              </div>
            ) : groupsError || groups.length === 0 ? (
              <TextField
                label="Source Group JID (manual)"
                value={form.sourceGroupJid}
                onChange={(e) =>
                  setForm({ ...form, sourceGroupJid: e.target.value })
                }
                fullWidth
                margin="dense"
                placeholder="1234567890-123456@g.us"
                helperText={
                  groupsError
                    ? "Could not load groups, enter JID manually"
                    : "No groups found, enter JID manually"
                }
              />
            ) : (
              <FormControl fullWidth margin="dense">
                <InputLabel>Source Group</InputLabel>
                <Select
                  value={form.sourceGroupJid}
                  onChange={(e) =>
                    setForm({ ...form, sourceGroupJid: e.target.value })
                  }
                >
                  {groups.map((g) => (
                    <MenuItem key={g.jid || g.id} value={g.jid || g.id}>
                      {g.name || g.subject || g.jid}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Target Group */}
            {groupsLoading ? (
              <div className={classes.groupSelectLoading}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="textSecondary">
                  Loading groups...
                </Typography>
              </div>
            ) : groupsError || groups.length === 0 ? (
              <TextField
                label="Target Group JID (manual)"
                value={form.targetGroupJid}
                onChange={(e) =>
                  setForm({ ...form, targetGroupJid: e.target.value })
                }
                fullWidth
                margin="dense"
                placeholder="1234567890-123456@g.us"
                helperText={
                  groupsError
                    ? "Could not load groups, enter JID manually"
                    : "No groups found, enter JID manually"
                }
              />
            ) : (
              <FormControl fullWidth margin="dense">
                <InputLabel>Target Group</InputLabel>
                <Select
                  value={form.targetGroupJid}
                  onChange={(e) =>
                    setForm({ ...form, targetGroupJid: e.target.value })
                  }
                >
                  {groups.map((g) => (
                    <MenuItem key={g.jid || g.id} value={g.jid || g.id}>
                      {g.name || g.subject || g.jid}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Authorized Numbers (one per line)"
              value={form.adminNumbers}
              onChange={(e) =>
                setForm({ ...form, adminNumbers: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              margin="dense"
              placeholder="573001234567&#10;573009876543"
              helperText="Admin numbers that can trigger forwarding"
            />

            <div className={classes.twoCol}>
              <TextField
                label="Time Window (minutes)"
                type="number"
                value={form.timeWindowMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    timeWindowMinutes: e.target.value,
                  })
                }
                fullWidth
                margin="dense"
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Max Images"
                type="number"
                value={form.maxForward}
                onChange={(e) =>
                  setForm({ ...form, maxForward: e.target.value })
                }
                fullWidth
                margin="dense"
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Delay Between (ms)"
                type="number"
                value={form.delayBetweenMs}
                onChange={(e) =>
                  setForm({ ...form, delayBetweenMs: e.target.value })
                }
                fullWidth
                margin="dense"
                inputProps={{ min: 500, step: 500 }}
              />
            </div>

            <TextField
              label="Custom Caption (optional)"
              value={form.customCaption}
              onChange={(e) =>
                setForm({ ...form, customCaption: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
              margin="dense"
              placeholder="Optional caption to add to forwarded images"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
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

      {/* Logs Modal */}
      <Dialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Logs: {logsRuleName}</DialogTitle>
        <DialogContent>
          {logsLoading ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <CircularProgress />
            </div>
          ) : logsData.length === 0 ? (
            <Typography align="center" color="textSecondary">
              No logs yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">Date</TableCell>
                  <TableCell align="center">Admin</TableCell>
                  <TableCell align="center">Images</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logsData.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell align="center">
                      {log.executedAt
                        ? new Date(log.executedAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell align="center">{log.adminNumber}</TableCell>
                    <TableCell align="center">{log.imageCount}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={STATUS_LABELS[log.status] || log.status}
                        size="small"
                        className={
                          classes[
                            STATUS_CHIP_CLASSES[log.status] || "chipDefault"
                          ]
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      {log.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsOpen(false)} color="secondary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Auto Forward</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={openCreate}
          >
            + Add Rule
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">WhatsApp</TableCell>
              <TableCell align="center">Source Group</TableCell>
              <TableCell align="center">Target Group</TableCell>
              <TableCell align="center">Mode</TableCell>
              <TableCell align="center">Admins</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell align="center">{rule.name}</TableCell>
                <TableCell align="center">
                  {whatsApps.find((w) => w.id === rule.whatsappId)?.name ||
                    `#${rule.whatsappId}`}
                </TableCell>
                <TableCell align="center" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  <Tooltip title={`${getGroupName(rule.sourceGroupJid)}\n${rule.sourceGroupJid}`}>
                    <span>{getGroupName(rule.sourceGroupJid)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="center" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  <Tooltip title={`${getGroupName(rule.targetGroupJid)}\n${rule.targetGroupJid}`}>
                    <span>{getGroupName(rule.targetGroupJid)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    icon={<Forward style={{ fontSize: 14 }} />}
                    label="Bajo Demanda"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  {formatAdminNumbers(rule.adminNumbers)}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={rule.enabled ? "Active" : "Disabled"}>
                    <span
                      style={{
                        color: rule.enabled ? "green" : "gray",
                        fontWeight: "bold",
                      }}
                    >
                      {rule.enabled ? "ON" : "OFF"}
                    </span>
                  </Tooltip>
                  <Switch
                    size="small"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule)}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => openEdit(rule)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => fetchLogs(rule)}
                  >
                    <ListAlt />
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
                  No auto-forward rules yet. Click "+ Add Rule" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default AutoForwards;
