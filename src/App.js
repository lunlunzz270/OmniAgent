import React, { useState } from "react";
import KnowledgeTableManager, { KnowledgeDragger } from "./components/PdfUploader";
import ChatComponent from "./components/ChatComponent";
import RenderQA from "./components/RenderQA";
import { Layout, Typography, Button, Drawer, Space } from "antd";
import {
  RobotOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#001529",
  padding: "0 28px",
  height: "72px", // Increased height to prevent any title clipping
  lineHeight: "normal",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  position: "sticky",
  top: 0,
  zIndex: 1000,
};

const chatContainerStyle = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: "rgba(255, 255, 255, 0.98)",
  backdropFilter: "blur(12px)",
  padding: "16px 24px 20px 24px",
  boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.06)",
  zIndex: 900,
};

const App = () => {
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleResp = (question, answer) => {
    setConversation((prev) => [...prev, { question, answer }]);
  };

  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#f7f9fc" }}>
      {/* Top Navigation Bar */}
      <Header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <RobotOutlined style={{ color: "#1677ff", fontSize: "30px" }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Title
              level={3}
              style={{
                color: "#ffffff",
                margin: 0,
                fontSize: "20px",
                fontWeight: "600",
                letterSpacing: "0.5px",
                lineHeight: "26px",
              }}
            >
              OmniAgent
            </Title>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.65)",
                fontSize: "12px",
                lineHeight: "16px",
                marginTop: "2px",
              }}
            >
              Multimodal RAG & MCP-Enabled Knowledge Copilot
            </Text>
          </div>
        </div>

        <div>
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={() => setIsDrawerOpen(true)}
            size="middle"
            style={{ borderRadius: "6px", fontWeight: "500" }}
          >
            Manage Knowledge Base
          </Button>
        </div>
      </Header>

      {/* Main Chat Conversation Area */}
      <Content
        style={{
          width: "100%",
          maxWidth: "960px",
          margin: "0 auto",
          padding: "28px 20px 140px 20px",
          overflowY: "auto",
        }}
      >
        {conversation.length === 0 && !isLoading ? (
          <div style={{ maxWidth: "780px", margin: "40px auto 0 auto" }}>
            {/* Restored Dragger in the center as requested */}
            <div style={{ marginBottom: "28px" }}>
              <KnowledgeDragger onUploadSuccess={() => {}} />
            </div>

            <div style={{ textAlign: "center", color: "#8c8c8c" }}>
              <Text type="secondary" style={{ fontSize: "14px" }}>
                💡 Tip: Ask questions below. OmniAgent will dynamically route queries between your
                uploaded documents and live web search via MCP.
              </Text>
            </div>
          </div>
        ) : (
          <RenderQA conversation={conversation} isLoading={isLoading} />
        )}
      </Content>

      {/* Floating Bottom Input Bar */}
      <div style={chatContainerStyle}>
        <ChatComponent
          handleResp={handleResp}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      </div>

      {/* Knowledge Base Side Drawer */}
      <Drawer
        title={
          <Space>
            <FolderOpenOutlined style={{ color: "#1677ff" }} />
            <span>Knowledge Base Management</span>
          </Space>
        }
        placement="right"
        width={680} // Generous width for professional table display
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        styles={{ body: { padding: "20px", backgroundColor: "#f9fafb" } }}
      >
        <KnowledgeTableManager />
      </Drawer>
    </Layout>
  );
};

export default App;
