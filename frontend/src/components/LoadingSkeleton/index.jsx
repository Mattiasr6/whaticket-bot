import React from "react";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import { Paper } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  "@keyframes pulse": {
    "0%": { opacity: 0.6 },
    "50%": { opacity: 1 },
    "100%": { opacity: 0.6 },
  },
  root: {
    animation: "$pulse 1.5s ease-in-out infinite",
    backgroundColor: theme.palette.action.hover,
    borderRadius: 8,
  },
  statCard: {
    height: 120,
    borderRadius: 12,
  },
  table: {
    height: 40,
    marginBottom: 8,
    width: "100%",
  },
  form: {
    height: 56,
    marginBottom: 16,
    width: "100%",
  },
  chart: {
    height: 300,
    borderRadius: 12,
  },
  text: {
    height: 16,
    marginBottom: 8,
    width: "60%",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
  },
  inline: {
    display: "inline-block",
    width: 80,
    height: 12,
    marginLeft: 8,
  },
}));

const VARIANT_MAP = {
  statCard: { className: "statCard" },
  table: { className: "table" },
  form: { className: "form" },
  chart: { className: "chart" },
  text: { className: "text" },
  avatar: { className: "avatar" },
  inline: { className: "inline" },
};

const LoadingSkeleton = ({ variant = "text", count = 1 }) => {
  const classes = useStyles();
  const v = VARIANT_MAP[variant] || VARIANT_MAP.text;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Paper
          key={i}
          className={clsx(classes.root, classes[v.className])}
          elevation={0}
        />
      ))}
    </>
  );
};

LoadingSkeleton.propTypes = {
  variant: PropTypes.oneOf(["statCard", "table", "form", "chart", "text", "avatar", "inline"]),
  count: PropTypes.number,
};

export default LoadingSkeleton;
