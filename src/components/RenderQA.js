import React from "react";
import { Spin, Tag, Typography, Space, Tooltip } from "antd";
import {
  FileTextOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Text, Paragraph } = Typography;

// ==========================================
// 1. Style Definitions
// ==========================================

const containerStyle = {
  display: "flex",
  flexDirection: "column",
  marginBottom: "24px",
};

const userRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "12px",
};

const userBubbleStyle = {
  maxWidth: "65%",
  backgroundColor: "#1677ff",
  color: "#ffffff",
  borderRadius: "16px 16px 4px 16px",
  padding: "12px 18px",
  boxShadow: "0 2px 6px rgba(22, 119, 255, 0.15)",
  fontSize: "14px",
  lineHeight: "1.5",
};

const agentRowStyle = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: "12px",
};

const agentCardStyle = {
  maxWidth: "75%",
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "16px 16px 16px 4px",
  padding: "16px 20px",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
};

const answerTextStyle = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#262626",
  margin: "8px 0",
};

// ==========================================
// 2. Sub-component: RouteStatusBadge
// ==========================================

const RouteStatusBadge = ({ sourceType, confidence, routeReason }) => {
  const percentText = confidence ? `${Math.round(confidence * 100)}%` : null;

  let badgeConfig = {
    color: "blue",
    icon: <FileTextOutlined />,
    label: "Private Document RAG",
  };

  if (sourceType === "MCP_WEB_SEARCH") {
    badgeConfig = {
      color: "green",
      icon: <GlobalOutlined />,
      label: "Live Web Search (SerpAPI MCP)",
    };
  } else if (sourceType === "HYBRID") {
    badgeConfig = {
      color: "purple",
      icon: <ThunderboltOutlined />,
      label: "Hybrid Retrieval Synthesis",
    };
  }

  return (
    <Space size="small" wrap>
      <Tag color={badgeConfig.color} icon={badgeConfig.icon} style={{ padding: "2px 8px" }}>
        {badgeConfig.label}
      </Tag>
      {percentText && sourceType !== "MCP_WEB_SEARCH" && (
        <Tag color="cyan">Match: {percentText}</Tag>
      )}
      {routeReason && (
        <Tooltip title={routeReason}>
          <Text type="secondary" style={{ fontSize: "12px", cursor: "pointer" }}>
            <InfoCircleOutlined /> Routing Info
          </Text>
        </Tooltip>
      )}
    </Space>
  );
};

// ==========================================
// 3. Sub-component: SourceTags
// ==========================================

const SourceTags = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #f0f0f0" }}>
      <Space size={[4, 6]} wrap>
        <Text type="secondary" style={{ fontSize: "12px" }}>
          Sources:
        </Text>
        {sources.map((src, idx) => (
          <Tag key={idx} color="default" style={{ fontSize: "11px", borderRadius: "4px" }}>
            {src.includes("SerpAPI") ? <GlobalOutlined style={{ marginRight: "4px" }} /> : <FileTextOutlined style={{ marginRight: "4px" }} />}
            {src}
          </Tag>
        ))}
      </Space>
    </div>
  );
};

// ==========================================
// 4. Main Component: RenderQA
// ==========================================

const RenderQA = ({ conversation, isLoading }) => {
  return (
    <div style={{ width: "100%", maxWidth: "880px", margin: "0 auto" }}>
      {conversation?.map((each, index) => {
        const rawAns = each.answer || {};
        // Unified answer string (supports both modern payload and backward compatibility)
        const displayText =
          rawAns.answer ||
          rawAns.ragAnswer ||
          rawAns.mcpAnswer ||
          (typeof rawAns === "string" ? rawAns : "No response generated.");

        const sourceType = rawAns.sourceType || (rawAns.ragAnswer ? "DOCUMENT_RAG" : "MCP_WEB_SEARCH");
        const sources = rawAns.sources || [];
        const confidence = rawAns.confidence || 0;
        const routeReason = rawAns.routeReason || "";

        return (
          <div key={index} style={containerStyle}>
            {/* User Question Row */}
            <div style={userRowStyle}>
              <div style={userBubbleStyle}>
                <Space align="start">
                  <UserOutlined style={{ marginTop: "3px" }} />
                  <span>{each.question}</span>
                </Space>
              </div>
            </div>

            {/* Agent Answer Row */}
            <div style={agentRowStyle}>
              <div style={agentCardStyle}>
                {/* Header: Agent identity & dynamic routing badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Space>
                    <RobotOutlined style={{ color: "#1677ff", fontSize: "16px" }} />
                    <Text strong style={{ fontSize: "13px", color: "#595959" }}>
                      OmniAgent
                    </Text>
                  </Space>
                  <RouteStatusBadge
                    sourceType={sourceType}
                    confidence={confidence}
                    routeReason={routeReason}
                  />
                </div>

                {/* Body: Synthesized Answer Text */}
                <Paragraph style={answerTextStyle}>
                  {displayText}
                </Paragraph>

                {/* Footer: Grounded Source Attribution */}
                <SourceTags sources={sources} />
              </div>
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" tip="OmniAgent is retrieving context and synthesizing answer..." />
        </div>
      )}
    </div>
  );
};

export default RenderQA;
