import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Avatar,
  Button,
  CssBaseline,
  TextField,
  Grid,
  Box,
  Typography,
  Container,
  InputAdornment,
  IconButton,
  Link,
  Paper
} from '@material-ui/core';

import { Visibility, VisibilityOff } from '@material-ui/icons';

import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2d5a87 100%)",
  },
  card: {
    padding: theme.spacing(5, 4),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    maxWidth: 420,
    width: "100%",
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(2),
  },
  logoSvg: {
    width: 36,
    height: 36,
    fill: "white",
  },
  title: {
    fontWeight: 700,
    fontSize: "1.5rem",
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
    fontSize: "0.9rem",
  },
  form: {
    width: "100%",
  },
  submit: {
    margin: theme.spacing(2, 0, 1.5),
    padding: theme.spacing(1.3),
    fontWeight: 600,
    fontSize: "0.95rem",
    borderRadius: 8,
    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    color: "#fff",
    "&:hover": {
      background: "linear-gradient(135deg, #2563eb, #0891b2)",
    },
  },
  link: {
    color: theme.palette.primary.main,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}));

const Login = () => {
  const classes = useStyles();

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const { handleLogin } = useContext(AuthContext);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlSubmit = (e) => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <div className={classes.root}>
      <CssBaseline />
      <Container component="main" maxWidth="xs">
        <Paper className={classes.card} elevation={0}>
          <div className={classes.logo}>
            <svg className={classes.logoSvg} viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <Typography className={classes.title} component="h1" variant="h5">
            {i18n.t("login.title")}
          </Typography>
          <Typography className={classes.subtitle} variant="body2">
            Ingrese sus credenciales para acceder al sistema
          </Typography>
          <form className={classes.form} noValidate onSubmit={handlSubmit}>
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              id="email"
              label={i18n.t("login.form.email")}
              name="email"
              value={user.email}
              onChange={handleChangeInput}
              autoComplete="email"
              autoFocus
              size="small"
            />
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              name="password"
              label={i18n.t("login.form.password")}
              id="password"
              value={user.password}
              onChange={handleChangeInput}
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword((e) => !e)}
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              className={classes.submit}
            >
              {i18n.t("login.buttons.submit")}
            </Button>
            <Grid container justify="center">
              <Grid item>
                <Link
                  href="#"
                  variant="body2"
                  component={RouterLink}
                  to="/signup"
                  className={classes.link}
                >
                  {i18n.t("login.buttons.register")}
                </Link>
              </Grid>
            </Grid>
          </form>
        </Paper>
        <Box mt={4} textAlign="center">
          <Typography variant="caption" style={{ color: "rgba(255,255,255,0.5)" }}>
            &copy; {new Date().getFullYear()} FlowMed
          </Typography>
        </Box>
      </Container>
    </div>
  );
};

export default Login;
