export const AGENT_CONFIG_COMPONENT_MAP = {
    agent: {
        client: "<client>",
        buffer: "<client_buffer>",
        labels: "<labels>",
        internal: "<agent>, <monitord>, <remoted>",
        anti_tampering: "<anti_tampering>",
    },
    agentless: {
        agentless: "<agentless>",
    },
    analysis: {
        global: "<global>",
        active_response: "<active-response>",
        alerts: "<alerts>",
        command: "<command>",
        rules: "<rule>",
        decoders: "<decoder>",
        internal: "<analysisd>",
        rule_test: "<rule_test>",
    },
    auth: {
        auth: "<auth>",
    },
    com: {
        "active-response": "<active-response>",
        logging: "<logging>",
        internal: "<execd>",
        cluster: "<cluster>",
    },
    csyslog: {
        csyslog: "<csyslog_output>",
    },
    integrator: {
        integration: "<integration>",
    },
    logcollector: {
        localfile: "<localfile>",
        socket: "<socket>",
        internal: "<logcollector>",
    },
    mail: {
        global: "<global>, <email...>",
        alerts: "<email_alerts>",
        internal: "<maild>",
    },
    monitor: {
        global: "<global>",
        internal: "<monitord>",
        reports: "<reports>",
    },
    request: {
        global: "<global>",
        remote: "<remote>",
        internal: "<remoted>",
    },
    syscheck: {
        syscheck: "<syscheck>",
        rootcheck: "<rootcheck>",
        internal: "<syscheck>, <rootcheck>",
    },
    "wazuh-db": {
        internal: "<wazuh_db>",
        wdb: "<wdb>",
    },
    wmodules: {
        wmodules: "<wodle>",
    },
};

// Component chỉ tồn tại trên manager (agent 000)
const MANAGER_ONLY_COMPONENTS = ["analysis", "mail", "monitor", "request", "auth"];
// Component chỉ tồn tại trên agent thật (không có ở manager)
const AGENT_ONLY_COMPONENTS = ["agent", "agentless", "csyslog", "integrator"];

export const isValidAgentConfig = (agentId, component, configuration) => {
    const validConfigs = AGENT_CONFIG_COMPONENT_MAP[component];
    if (!validConfigs || !Object.prototype.hasOwnProperty.call(validConfigs, configuration)) {
        return false;
    }

    const isManager = agentId === "000";
    if (isManager && AGENT_ONLY_COMPONENTS.includes(component)) return false;
    if (!isManager && MANAGER_ONLY_COMPONENTS.includes(component)) return false;

    return true;
};