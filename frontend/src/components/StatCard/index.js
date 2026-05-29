import React from "react";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
		display: "flex",
		flexDirection: "column",
		height: 120,
		overflow: "hidden",
	},
	value: {
		fontWeight: 600,
	},
}));

const StatCard = ({ title, value, color = "primary" }) => {
	const classes = useStyles();

	return (
		<Paper className={classes.paper}>
			<Typography component="h3" variant="h6" color={color} paragraph>
				{title}
			</Typography>
			<Typography component="h1" variant="h4" className={classes.value}>
				{value}
			</Typography>
		</Paper>
	);
};

export default StatCard;
