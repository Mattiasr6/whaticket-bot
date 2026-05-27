import React, { useState, useEffect, useContext, useCallback } from "react";
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
  CircularProgress,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Box,
  AppBar,
  TableContainer,
} from "@material-ui/core";
import {
  Edit,
  DeleteOutline,
  Add,
  Image,
} from "@material-ui/icons";

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
    maxWidth: 600,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(2),
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: theme.spacing(2),
  },
  groupSelectLoading: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
  tabPanel: {
    padding: theme.spacing(2, 0),
  },
  stickerGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
  },
  stickerCard: {
    width: 160,
  },
  stickerThumb: {
    height: 140,
    objectFit: "cover",
  },
  configSection: {
    marginBottom: theme.spacing(2),
  },
  hoursRow: {
    display: "grid",
    gridTemplateColumns: "100px 1fr 20px 1fr",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(0.5),
  },
  dayLabel: {
    fontWeight: 500,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    fontSize: "0.8rem",
  },
}));

const DAYS = [
  { key: "lunes",     label: "Lunes" },
  { key: "martes",    label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves",    label: "Jueves" },
  { key: "viernes",   label: "Viernes" },
  { key: "sabado",    label: "Sábado" },
  { key: "domingo",   label: "Domingo" },
];

const EMPTY_BUSINESS_HOURS = () => {
  const obj = {};
  DAYS.forEach((d) => { obj[d.key] = { from: "", to: "" }; });
  return obj;
};

const EVENT_TYPES = [
  { value: "", label: "All" },
  { value: "welcome", label: "Welcome" },
  { value: "farewell", label: "Farewell" },
  { value: "faq", label: "FAQ" },
  { value: "spam", label: "Spam" },
  { value: "promo", label: "Promo" },
  { value: "sticker", label: "Sticker" },
  { value: "inactivity_reminder", label: "Inactivity" },
  { value: "quiet_mode", label: "Quiet Mode" },
];

const BotCajero = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);

  // Tab state
  const [tabIndex, setTabIndex] = useState(0);

  // Config state
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState("");
  const [configForm, setConfigForm] = useState({
    groupJid: "",
    groupName: "",
    adminNumber: "",
    welcomeMessage: "",
    farewellMessage: "",
    rules: "",
    welcomeEnabled: true,
    farewellEnabled: true,
    autoReplyEnabled: true,
    antiSpamEnabled: true,
    quietModeEnabled: false,
    quietModeStart: "23:00",
    quietModeEnd: "08:00",
    inactivityHours: 24,
  });
  const [businessHours, setBusinessHours] = useState(EMPTY_BUSINESS_HOURS());

  // FAQs state
  const [faqs, setFaqs] = useState([]);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqForm, setFaqForm] = useState({
    keywords: "",
    response: "",
    matchType: "contains",
    enabled: true,
    priority: 0,
  });
  const [deletingFaq, setDeletingFaq] = useState(null);
  const [faqConfirmOpen, setFaqConfirmOpen] = useState(false);

  // Spam rules state
  const [spamRules, setSpamRules] = useState([]);
  const [spamModalOpen, setSpamModalOpen] = useState(false);
  const [spamForm, setSpamForm] = useState({
    type: "link_block",
    pattern: "",
    action: "delete_silent",
    enabled: true,
  });
  const [deletingSpam, setDeletingSpam] = useState(null);
  const [spamConfirmOpen, setSpamConfirmOpen] = useState(false);

  // Stickers state
  const [stickers, setStickers] = useState([]);
  const [stickerForm, setStickerForm] = useState({
    mediaPath: "",
    mediaName: "",
  });
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [deletingSticker, setDeletingSticker] = useState(null);
  const [stickerConfirmOpen, setStickerConfirmOpen] = useState(false);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logEventFilter, setLogEventFilter] = useState("");

  // ====== Config load ======
  const fetchConfig = useCallback(async (whatsappId) => {
    if (!whatsappId) {
      setConfig(null);
      setFaqs([]);
      setSpamRules([]);
      setStickers([]);
      setLogs([]);
      return;
    }
    setConfigLoading(true);
    try {
      const { data } = await api.get(`/bot-cajero/${whatsappId}`);
      setConfig(data);
      setConfigForm({
        groupJid: data.groupJid || "",
        groupName: data.groupName || "",
        adminNumber: data.adminNumber || "",
        welcomeMessage: data.welcomeMessage || "",
        farewellMessage: data.farewellMessage || "",
        rules: data.rules || "",
        welcomeEnabled: data.welcomeEnabled !== false,
        farewellEnabled: data.farewellEnabled !== false,
        autoReplyEnabled: data.autoReplyEnabled !== false,
        antiSpamEnabled: data.antiSpamEnabled !== false,
        quietModeEnabled: data.quietModeEnabled || false,
        quietModeStart: data.quietModeStart || "23:00",
        quietModeEnd: data.quietModeEnd || "08:00",
        inactivityHours: data.inactivityHours ?? 24,
      });
      // Parse business hours
      if (data.businessHours) {
        try {
          const parsed = JSON.parse(data.businessHours);
          const bh = EMPTY_BUSINESS_HOURS();
          DAYS.forEach((d) => {
            const range = parsed[d.key];
            if (range && range.includes("-")) {
              const parts = range.split("-");
              bh[d.key] = { from: parts[0].trim(), to: parts[1].trim() };
            }
          });
          setBusinessHours(bh);
        } catch (_) {
          setBusinessHours(EMPTY_BUSINESS_HOURS());
        }
      } else {
        setBusinessHours(EMPTY_BUSINESS_HOURS());
      }
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
      setSpamRules(Array.isArray(data.spamRules) ? data.spamRules : []);
      setStickers(Array.isArray(data.stickers) ? data.stickers : []);
    } catch (err) {
      if (err.response?.status === 404) {
        setConfig(null);
        setFaqs([]);
        setSpamRules([]);
        setStickers([]);
        setLogs([]);
        setBusinessHours(EMPTY_BUSINESS_HOURS());
        setConfigForm({
          groupJid: "",
          groupName: "",
          adminNumber: "",
          welcomeMessage: "",
          farewellMessage: "",
          rules: "",
          welcomeEnabled: true,
          farewellEnabled: true,
          autoReplyEnabled: true,
          antiSpamEnabled: true,
          quietModeEnabled: false,
          quietModeStart: "23:00",
          quietModeEnd: "08:00",
          inactivityHours: 24,
        });
      } else {
        toastError(err);
      }
    }
    setConfigLoading(false);
  }, []);

  // Load groups when whatsappId changes
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

  useEffect(() => {
    if (selectedWhatsAppId) {
      fetchConfig(selectedWhatsAppId);
      fetchGroups(selectedWhatsAppId);
    }
  }, [selectedWhatsAppId, fetchConfig]);

  // ====== Config save ======
  const handleSaveConfig = async () => {
    if (!selectedWhatsAppId) {
      toast.warn("Select a WhatsApp connection first");
      return;
    }
    if (!configForm.groupJid) {
      toast.warn("Group to moderate is required");
      return;
    }
    if (!configForm.adminNumber) {
      toast.warn("Admin number is required");
      return;
    }
    try {
      // Serialize business hours to JSON string
      const hoursObj = {};
      DAYS.forEach((d) => {
        const val = businessHours[d.key];
        if (val && val.from && val.to) {
          hoursObj[d.key] = `${val.from}-${val.to}`;
        }
      });
      const payload = {
        ...configForm,
        inactivityHours: Number(configForm.inactivityHours),
        businessHours: JSON.stringify(hoursObj),
      };
      const { data } = await api.put(
        `/bot-cajero/${selectedWhatsAppId}`,
        payload
      );
      setConfig(data);
      toast.success("Configuration saved");
    } catch (err) {
      toastError(err);
    }
  };

  // ====== FAQs ======
  const openCreateFaq = () => {
    setEditingFaq(null);
    setFaqForm({
      keywords: "",
      response: "",
      matchType: "contains",
      enabled: true,
      priority: 0,
    });
    setFaqModalOpen(true);
  };

  const openEditFaq = (faq) => {
    setEditingFaq(faq);
    setFaqForm({
      keywords: faq.keywords || "",
      response: faq.response || "",
      matchType: faq.matchType || "contains",
      enabled: faq.enabled !== false,
      priority: faq.priority ?? 0,
    });
    setFaqModalOpen(true);
  };

  const handleSaveFaq = async () => {
    if (!faqForm.keywords || !faqForm.response) {
      toast.warn("Keywords and response are required");
      return;
    }
    try {
      if (editingFaq) {
        await api.put(
          `/bot-cajero/${selectedWhatsAppId}/faqs/${editingFaq.id}`,
          faqForm
        );
        toast.success("FAQ updated");
      } else {
        await api.post(
          `/bot-cajero/${selectedWhatsAppId}/faqs`,
          faqForm
        );
        toast.success("FAQ created");
      }
      setFaqModalOpen(false);
      setEditingFaq(null);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteFaq = async () => {
    if (!deletingFaq) return;
    try {
      await api.delete(
        `/bot-cajero/${selectedWhatsAppId}/faqs/${deletingFaq.id}`
      );
      toast.success("FAQ deleted");
      setFaqConfirmOpen(false);
      setDeletingFaq(null);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  // ====== Spam Rules ======
  const openCreateSpam = () => {
    setSpamForm({
      type: "link_block",
      pattern: "",
      action: "delete_silent",
      enabled: true,
    });
    setSpamModalOpen(true);
  };

  const handleSaveSpam = async () => {
    if (!spamForm.pattern) {
      toast.warn("Pattern is required");
      return;
    }
    try {
      await api.post(
        `/bot-cajero/${selectedWhatsAppId}/spam-rules`,
        spamForm
      );
      toast.success("Spam rule created");
      setSpamModalOpen(false);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteSpam = async () => {
    if (!deletingSpam) return;
    try {
      await api.delete(
        `/bot-cajero/${selectedWhatsAppId}/spam-rules/${deletingSpam.id}`
      );
      toast.success("Spam rule deleted");
      setSpamConfirmOpen(false);
      setDeletingSpam(null);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  // ====== Stickers ======
  const openAddSticker = () => {
    setStickerForm({ mediaPath: "", mediaName: "" });
    setStickerModalOpen(true);
  };

  const handleSaveSticker = async () => {
    if (!stickerForm.mediaPath) {
      toast.warn("Media path is required");
      return;
    }
    try {
      await api.post(
        `/bot-cajero/${selectedWhatsAppId}/stickers`,
        stickerForm
      );
      toast.success("Sticker added");
      setStickerModalOpen(false);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteSticker = async () => {
    if (!deletingSticker) return;
    try {
      await api.delete(
        `/bot-cajero/${selectedWhatsAppId}/stickers/${deletingSticker.id}`
      );
      toast.success("Sticker deleted");
      setStickerConfirmOpen(false);
      setDeletingSticker(null);
      fetchConfig(selectedWhatsAppId);
    } catch (err) {
      toastError(err);
    }
  };

  // ====== Logs ======
  const fetchLogs = useCallback(async () => {
    if (!config?.id) return;
    setLogsLoading(true);
    try {
      const params = logEventFilter ? { eventType: logEventFilter } : {};
      const { data } = await api.get(
        `/bot-cajero/${selectedWhatsAppId}/logs`,
        { params }
      );
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
    setLogsLoading(false);
  }, [config, logEventFilter, selectedWhatsAppId]);

  useEffect(() => {
    if (tabIndex === 4 && config?.id) {
      fetchLogs();
    }
  }, [tabIndex, config, fetchLogs]);

  useEffect(() => {
    if (tabIndex === 4 && config?.id) {
      fetchLogs();
    }
  }, [logEventFilter]);

  // ====== Group name helper ======
  const getGroupName = (jid) => {
    if (!jid) return "-";
    const g = groups.find((grp) => grp.jid === jid || grp.id === jid);
    return g ? g.name || g.subject || jid : jid;
  };

  // ====== Tab helpers ======
  const matchTypeLabel = (t) => {
    switch (t) {
      case "contains": return "Contains";
      case "exact": return "Exact";
      case "all": return "All Keywords";
      default: return t;
    }
  };

  const spamActionLabel = (a) => {
    switch (a) {
      case "delete_silent": return "Delete Silent";
      case "delete_warn_private": return "Delete + Warn Private";
      case "warn_public": return "Warn Public";
      case "warn_private": return "Warn Private";
      default: return a;
    }
  };

  const spamTypeLabel = (t) => {
    switch (t) {
      case "link_block": return "Link Block";
      case "profanity": return "Profanity";
      default: return t;
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : "-");

  // ====== Render ======
  return (
    <MainContainer>
      {/* Delete confirmations */}
      <ConfirmationModal
        title={`Delete FAQ "${deletingFaq?.keywords?.substring(0, 30) || ""}"?`}
        open={faqConfirmOpen}
        onClose={() => setFaqConfirmOpen(false)}
        onConfirm={handleDeleteFaq}
      >
        This will permanently remove the FAQ.
      </ConfirmationModal>

      <ConfirmationModal
        title={`Delete spam rule "${deletingSpam?.pattern || ""}"?`}
        open={spamConfirmOpen}
        onClose={() => setSpamConfirmOpen(false)}
        onConfirm={handleDeleteSpam}
      >
        This will permanently remove the spam rule.
      </ConfirmationModal>

      <ConfirmationModal
        title={`Delete sticker "${deletingSticker?.mediaName || deletingSticker?.mediaPath || ""}"?`}
        open={stickerConfirmOpen}
        onClose={() => setStickerConfirmOpen(false)}
        onConfirm={handleDeleteSticker}
      >
        This will permanently remove the sticker.
      </ConfirmationModal>

      {/* FAQ Modal */}
      <Dialog
        open={faqModalOpen}
        onClose={() => setFaqModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingFaq ? "Edit FAQ" : "New FAQ"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <TextField
              label="Keywords (one per line)"
              value={faqForm.keywords}
              onChange={(e) =>
                setFaqForm({ ...faqForm, keywords: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              margin="dense"
              placeholder="deposito&#10;depósito&#10;carga"
            />
            <TextField
              label="Response"
              value={faqForm.response}
              onChange={(e) =>
                setFaqForm({ ...faqForm, response: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              margin="dense"
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Match Type</InputLabel>
              <Select
                value={faqForm.matchType}
                onChange={(e) =>
                  setFaqForm({ ...faqForm, matchType: e.target.value })
                }
              >
                <MenuItem value="contains">Contains</MenuItem>
                <MenuItem value="exact">Exact</MenuItem>
                <MenuItem value="all">All Keywords</MenuItem>
              </Select>
            </FormControl>
            <div className={classes.twoCol}>
              <TextField
                label="Priority"
                type="number"
                value={faqForm.priority}
                onChange={(e) =>
                  setFaqForm({ ...faqForm, priority: Number(e.target.value) })
                }
                fullWidth
                margin="dense"
                inputProps={{ min: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={faqForm.enabled}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, enabled: e.target.checked })
                    }
                  />
                }
                label="Enabled"
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFaqModalOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSaveFaq} color="primary" variant="contained">
            {editingFaq ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Spam Rule Modal */}
      <Dialog
        open={spamModalOpen}
        onClose={() => setSpamModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New Spam Rule</DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <FormControl fullWidth margin="dense">
              <InputLabel>Type</InputLabel>
              <Select
                value={spamForm.type}
                onChange={(e) =>
                  setSpamForm({ ...spamForm, type: e.target.value })
                }
              >
                <MenuItem value="link_block">Link Block</MenuItem>
                <MenuItem value="profanity">Profanity</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Pattern"
              value={spamForm.pattern}
              onChange={(e) =>
                setSpamForm({ ...spamForm, pattern: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder={
                spamForm.type === "link_block"
                  ? "competitor.com"
                  : "badword"
              }
              helperText={
                spamForm.type === "link_block"
                  ? "Domain to block"
                  : "Word to detect (case-insensitive)"
              }
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Action</InputLabel>
              <Select
                value={spamForm.action}
                onChange={(e) =>
                  setSpamForm({ ...spamForm, action: e.target.value })
                }
              >
                <MenuItem value="delete_silent">Delete Silent</MenuItem>
                <MenuItem value="delete_warn_private">
                  Delete + Warn Private
                </MenuItem>
                <MenuItem value="warn_public">Warn Public</MenuItem>
                <MenuItem value="warn_private">Warn Private</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={spamForm.enabled}
                  onChange={(e) =>
                    setSpamForm({ ...spamForm, enabled: e.target.checked })
                  }
                />
              }
              label="Enabled"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpamModalOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSaveSpam} color="primary" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sticker Modal */}
      <Dialog
        open={stickerModalOpen}
        onClose={() => setStickerModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Sticker</DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <TextField
              label="Media Path"
              value={stickerForm.mediaPath}
              onChange={(e) =>
                setStickerForm({ ...stickerForm, mediaPath: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="public/stickers/mi-sticker.webp"
              helperText="Path to the .webp sticker file in the public folder"
            />
            <TextField
              label="Name (optional)"
              value={stickerForm.mediaName}
              onChange={(e) =>
                setStickerForm({ ...stickerForm, mediaName: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="Welcome sticker"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStickerModalOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleSaveSticker}
            color="primary"
            variant="contained"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <MainHeader>
        <Title>Bot Cajero</Title>
        <MainHeaderButtonsWrapper style={{ gap: 8 }}>
          <FormControl style={{ minWidth: 200 }}>
            <Select
              value={selectedWhatsAppId}
              onChange={(e) => setSelectedWhatsAppId(e.target.value)}
              displayEmpty
              renderValue={(v) =>
                v
                  ? whatsApps.find((w) => w.id === v)?.name || `#${v}`
                  : "Select WhatsApp..."
              }
            >
              <MenuItem value="" disabled>
                Select a connection
              </MenuItem>
              {whatsApps.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name} ({w.status})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {/* Tabs */}
      <Paper className={classes.mainPaper} variant="outlined">
        <AppBar position="static" color="default">
          <Tabs
            value={tabIndex}
            onChange={(_, i) => setTabIndex(i)}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="⚙️ Configuration" />
            <Tab label="❓ FAQs" />
            <Tab label="🛡️ Anti-Spam" />
            <Tab label="🎨 Stickers" />
            <Tab label="📋 Logs" />
          </Tabs>
        </AppBar>

        {!selectedWhatsAppId && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Typography variant="body1" color="textSecondary">
              Select a WhatsApp connection above to configure Bot Cajero.
            </Typography>
          </div>
        )}

        {selectedWhatsAppId && configLoading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <CircularProgress />
          </div>
        )}

        {/* ====== TAB 0: Configuration ====== */}
        {selectedWhatsAppId && !configLoading && tabIndex === 0 && (
          <div className={classes.tabPanel}>
            <div className={classes.form}>
              <div className={classes.sectionTitle}>Group & Admin</div>

              {groupsLoading ? (
                <div className={classes.groupSelectLoading}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="textSecondary">
                    Loading groups...
                  </Typography>
                </div>
              ) : groupsError || groups.length === 0 ? (
                <TextField
                  label="Group to moderate (manual JID)"
                  value={configForm.groupJid}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, groupJid: e.target.value })
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
                  <InputLabel>Group to moderate</InputLabel>
                  <Select
                    value={configForm.groupJid}
                    onChange={(e) => {
                      const selected = groups.find(
                        (g) => (g.jid || g.id) === e.target.value
                      );
                      setConfigForm({
                        ...configForm,
                        groupJid: e.target.value,
                        groupName: selected?.name || selected?.subject || "",
                      });
                    }}
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
                label="Admin number (digits only)"
                value={configForm.adminNumber}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    adminNumber: e.target.value,
                  })
                }
                fullWidth
                margin="dense"
                placeholder="573001234567"
              />

              <div className={classes.sectionTitle}>Messages</div>

              <TextField
                label="Welcome message"
                value={configForm.welcomeMessage}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    welcomeMessage: e.target.value,
                  })
                }
                fullWidth
                multiline
                rows={2}
                margin="dense"
                placeholder={"🎉 ¡Bienvenido {{name}}!"}
              />

              <TextField
                label="Farewell message"
                value={configForm.farewellMessage}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    farewellMessage: e.target.value,
                  })
                }
                fullWidth
                multiline
                rows={2}
                margin="dense"
                placeholder={"👋 {{name}} salió del grupo."}
              />

              <TextField
                label="Group rules (for /reglas command)"
                value={configForm.rules}
                onChange={(e) =>
                  setConfigForm({ ...configForm, rules: e.target.value })
                }
                fullWidth
                multiline
                rows={3}
                margin="dense"
                placeholder="1. Respeto ante todo.&#10;2. No compartir enlaces de otros sitios."
              />

              <div className={classes.sectionTitle}>Toggles</div>

              <div className={classes.twoCol}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={configForm.welcomeEnabled}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          welcomeEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Welcome"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={configForm.farewellEnabled}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          farewellEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Farewell"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={configForm.autoReplyEnabled}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          autoReplyEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Auto-Reply"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={configForm.antiSpamEnabled}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          antiSpamEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Anti-Spam"
                />
              </div>

              <div className={classes.sectionTitle}>Horarios de Atención</div>

              {DAYS.map((day) => (
                <div key={day.key} className={classes.hoursRow}>
                  <span className={classes.dayLabel}>{day.label}</span>
                  <TextField
                    type="time"
                    value={businessHours[day.key]?.from || ""}
                    onChange={(e) =>
                      setBusinessHours({
                        ...businessHours,
                        [day.key]: {
                          ...businessHours[day.key],
                          from: e.target.value,
                        },
                      })
                    }
                    margin="dense"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ style: { fontSize: "0.9rem" } }}
                  />
                  <span style={{ textAlign: "center", color: "#999" }}>–</span>
                  <TextField
                    type="time"
                    value={businessHours[day.key]?.to || ""}
                    onChange={(e) =>
                      setBusinessHours({
                        ...businessHours,
                        [day.key]: {
                          ...businessHours[day.key],
                          to: e.target.value,
                        },
                      })
                    }
                    margin="dense"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ style: { fontSize: "0.9rem" } }}
                  />
                </div>
              ))}

              <div className={classes.sectionTitle}>Quiet Hours & Inactivity</div>

              <div className={classes.twoCol}>
                <TextField
                  label="Quiet start (HH:mm)"
                  type="time"
                  value={configForm.quietModeStart}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      quietModeStart: e.target.value,
                    })
                  }
                  fullWidth
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Quiet end (HH:mm)"
                  type="time"
                  value={configForm.quietModeEnd}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      quietModeEnd: e.target.value,
                    })
                  }
                  fullWidth
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                />
              </div>

              <TextField
                label="Inactivity hours"
                type="number"
                value={configForm.inactivityHours}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    inactivityHours: e.target.value,
                  })
                }
                fullWidth
                margin="dense"
                inputProps={{ min: 1 }}
                helperText="Bot sends icebreaker after this many hours without messages"
              />

              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveConfig}
                style={{ alignSelf: "flex-start", marginTop: 8 }}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        )}

        {/* ====== TAB 1: FAQs ====== */}
        {selectedWhatsAppId && !configLoading && tabIndex === 1 && (
          <div className={classes.tabPanel}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={openCreateFaq}
              style={{ marginBottom: 16 }}
              disabled={!config}
            >
              Add FAQ
            </Button>

            {!config ? (
              <Typography color="textSecondary">
                Save the configuration first to manage FAQs.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Keywords</TableCell>
                    <TableCell align="center">Response</TableCell>
                    <TableCell align="center">Match</TableCell>
                    <TableCell align="center">Priority</TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {faqs.map((faq) => (
                    <TableRow key={faq.id}>
                      <TableCell align="center">
                        {faq.keywords?.split("\n").slice(0, 2).map((kw, i) => (
                          <Chip
                            key={i}
                            label={kw.trim()}
                            size="small"
                            style={{ margin: 1 }}
                          />
                        ))}
                        {faq.keywords?.split("\n").length > 2 && "..."}
                      </TableCell>
                      <TableCell align="center" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {faq.response?.substring(0, 60)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={matchTypeLabel(faq.matchType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">{faq.priority}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={faq.enabled ? "Active" : "Disabled"}>
                          <span
                            style={{
                              color: faq.enabled ? "green" : "gray",
                              fontWeight: "bold",
                            }}
                          >
                            {faq.enabled ? "ON" : "OFF"}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => openEditFaq(faq)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeletingFaq(faq);
                            setFaqConfirmOpen(true);
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {faqs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No FAQs yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* ====== TAB 2: Anti-Spam ====== */}
        {selectedWhatsAppId && !configLoading && tabIndex === 2 && (
          <div className={classes.tabPanel}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={openCreateSpam}
              style={{ marginBottom: 16 }}
              disabled={!config}
            >
              Add Rule
            </Button>

            {!config ? (
              <Typography color="textSecondary">
                Save the configuration first to manage spam rules.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Type</TableCell>
                    <TableCell align="center">Pattern</TableCell>
                    <TableCell align="center">Action</TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {spamRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell align="center">
                        <Chip
                          label={spamTypeLabel(rule.type)}
                          size="small"
                          color={
                            rule.type === "link_block"
                              ? "secondary"
                              : "default"
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <code>{rule.pattern}</code>
                      </TableCell>
                      <TableCell align="center">
                        {spamActionLabel(rule.action)}
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
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeletingSpam(rule);
                            setSpamConfirmOpen(true);
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {spamRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No spam rules yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* ====== TAB 3: Stickers ====== */}
        {selectedWhatsAppId && !configLoading && tabIndex === 3 && (
          <div className={classes.tabPanel}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Image />}
              onClick={openAddSticker}
              style={{ marginBottom: 16 }}
              disabled={!config}
            >
              Add Sticker
            </Button>

            {!config ? (
              <Typography color="textSecondary">
                Save the configuration first to manage stickers.
              </Typography>
            ) : stickers.length === 0 ? (
              <Typography color="textSecondary">No stickers yet.</Typography>
            ) : (
              <div className={classes.stickerGrid}>
                {stickers.map((sticker) => (
                  <Card key={sticker.id} className={classes.stickerCard}>
                    <CardMedia
                      className={classes.stickerThumb}
                      image={sticker.mediaPath}
                      title={sticker.mediaName || "Sticker"}
                    />
                    <CardContent style={{ padding: 8 }}>
                      <Typography variant="caption" noWrap>
                        {sticker.mediaName || sticker.mediaPath}
                      </Typography>
                    </CardContent>
                    <CardActions style={{ justifyContent: "center" }}>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => {
                          setDeletingSticker(sticker);
                          setStickerConfirmOpen(true);
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 4: Logs ====== */}
        {selectedWhatsAppId && !configLoading && tabIndex === 4 && (
          <div className={classes.tabPanel}>
            <FormControl style={{ minWidth: 200, marginBottom: 16 }}>
              <InputLabel>Event Type</InputLabel>
              <Select
                value={logEventFilter}
                onChange={(e) => setLogEventFilter(e.target.value)}
              >
                {EVENT_TYPES.map((et) => (
                  <MenuItem key={et.value} value={et.value}>
                    {et.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!config ? (
              <Typography color="textSecondary">
                Save the configuration first to view logs.
              </Typography>
            ) : logsLoading ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <CircularProgress />
              </div>
            ) : logs.length === 0 ? (
              <Typography color="textSecondary">No logs yet.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Date</TableCell>
                    <TableCell align="center">Event</TableCell>
                    <TableCell align="center">Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell align="center">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={log.eventType}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">{log.detail || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </Paper>
    </MainContainer>
  );
};

export default BotCajero;
