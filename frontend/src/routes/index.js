import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import Connections from "../pages/Connections/";
import Settings from "../pages/Settings/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import CronJobs from "../pages/CronJobs/";
import FlowBotList from "../pages/FlowBot/FlowBotList";
import FlowBotEditor from "../pages/FlowBot/FlowBotEditor";
import AutoForwards from "../pages/AutoForwards/";
import BotCajero from "../pages/BotCajero/";
import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { ThemeProvider } from "../context/DarkMode";
import Route from "./Route";

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <WhatsAppsProvider>
              <LoggedInLayout>
                <Route exact path="/" component={Dashboard} isPrivate />
                <Route exact path="/connections" component={Connections} isPrivate />
                <Route exact path="/contacts" component={Contacts} isPrivate />
                <Route exact path="/users" component={Users} isPrivate />
                <Route exact path="/Settings" component={Settings} isPrivate />
                <Route exact path="/cron-jobs" component={CronJobs} isPrivate />
                <Route exact path="/flow-bots" component={FlowBotList} isPrivate />
                <Route exact path="/flow-bots/:id/edit" component={FlowBotEditor} isPrivate />
                <Route exact path="/auto-reenvio" component={AutoForwards} isPrivate />
                <Route exact path="/bot-cajero" component={BotCajero} isPrivate />
              </LoggedInLayout>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer autoClose={3000} />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
