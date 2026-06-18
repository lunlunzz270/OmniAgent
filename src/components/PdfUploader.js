import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  InboxOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  message,
  Upload,
  Table,
  Button,
  Popconfirm,
  Tag,
  Typography,
  Space,
  Tooltip,
  Input,
} from "antd";

const { Dragger } = Upload;
const { Text } = Typography;

const DOMAIN = "http://localhost:5001";

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const apiFetchDocuments = async () => {
  const response = await axios.get(`${DOMAIN}/documents`);
  return response.data;
};

const apiUploadDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return await axios.post(`${DOMAIN}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

const apiDeleteDocument = async (fileName) => {
  const encodedName = encodeURIComponent(fileName);
  const response = await axios.delete(`${DOMAIN}/documents/${encodedName}`);
  return response.data;
};

/**
 * Clean Dragger Component (Used on main screen and inside drawer)
 */
export const KnowledgeDragger = ({ onUploadSuccess }) => {
  const draggerProps = {
    name: "file",
    multiple: true,
    showUploadList: false,
    accept: ".pdf",
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const response = await apiUploadDocument(file);
        if (response && response.status === 200) {
          onSuccess(response.data);
        } else {
          onError(new Error("Upload failed"));
        }
      } catch (err) {
        onError(err);
      }
    },
    onChange(info) {
      const { status } = info.file;
      if (status === "done") {
        message.success(`${info.file.name} uploaded and indexed successfully.`);
        if (onUploadSuccess) onUploadSuccess();
      } else if (status === "error") {
        message.error(`${info.file.name} upload failed.`);
      }
    },
  };

  return (
    <Dragger {...draggerProps} style={{ padding: "20px", borderRadius: "10px", background: "#fafafa" }}>
      <p className="ant-upload-drag-icon" style={{ marginBottom: "8px" }}>
        <InboxOutlined style={{ color: "#1677ff", fontSize: "40px" }} />
      </p>
      <p className="ant-upload-text" style={{ fontSize: "15px", fontWeight: "600", color: "#262626" }}>
        Click or drag PDF documents here to ingest into Knowledge Base
      </p>
      <p className="ant-upload-hint" style={{ fontSize: "12px", color: "#8c8c8c" }}>
        Supports multi-document vectorization. Files will be parsed, chunked, and indexed with metadata.
      </p>
    </Dragger>
  );
};

/**
 * Knowledge Base Table Manager (Clean, Paginated, Searchable Table)
 */
export const KnowledgeTableManager = () => {
  const [documents, setDocuments] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [searchText, setSearchText] = useState("");

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const data = await apiFetchDocuments();
      if (data && data.success) {
        setDocuments(data.documents || []);
        setTotalChunks(data.totalChunks || 0);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
      message.error("Could not load knowledge base documents.");
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (fileName) => {
    setDeletingFile(fileName);
    try {
      const result = await apiDeleteDocument(fileName);
      if (result && result.success) {
        message.success(`'${fileName}' and its vector embeddings were purged.`);
        await loadDocuments();
      } else {
        message.error(result?.error || "Failed to delete document.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      message.error("Failed to delete document from knowledge base.");
    } finally {
      setDeletingFile(null);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "Document Name",
      dataIndex: "fileName",
      key: "fileName",
      width: "55%",
      render: (text) => (
        <Space size="small" style={{ maxWidth: "100%" }}>
          <FilePdfOutlined style={{ color: "#ff4d4f", fontSize: "16px", flexShrink: 0 }} />
          <Tooltip title={text} placement="topLeft">
            <Text
              strong
              ellipsis={{ tooltip: false }}
              style={{ maxWidth: "260px", display: "inline-block", fontSize: "13px" }}
            >
              {text}
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Chunks",
      dataIndex: "chunksCount",
      key: "chunksCount",
      width: "18%",
      render: (chunks, record) => (
        <Space direction="vertical" size={2}>
          <Tag color="geekblue" style={{ margin: 0, fontSize: "11px" }}>
            {chunks} chunks
          </Tag>
          {record.pageCount && (
            <Text type="secondary" style={{ fontSize: "11px" }}>
              {record.pageCount} pgs
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Size",
      dataIndex: "fileSize",
      key: "fileSize",
      width: "15%",
      render: (size) => (
        <span style={{ whiteSpace: "nowrap", fontSize: "12px", color: "#595959" }}>
          {formatBytes(size)}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: "12%",
      align: "center",
      render: (_, record) => (
        <Popconfirm
          title="Remove Document"
          description={
            <div style={{ maxWidth: "240px" }}>
              Purge <strong>{record.fileName}</strong> and all its vector embeddings?
            </div>
          }
          onConfirm={() => handleDelete(record.fileName)}
          okText="Purge"
          cancelText="Cancel"
          okButtonProps={{ danger: true, size: "small" }}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deletingFile === record.fileName}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Upload area inside drawer */}
      <KnowledgeDragger onUploadSuccess={loadDocuments} />

      {/* Top Filter and Stats Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <Input
          placeholder="Filter documents by name..."
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="middle"
          style={{ maxWidth: "280px" }}
        />
        <Space size="small">
          <Tag color="blue">{documents.length} Docs</Tag>
          <Tag color="cyan">{totalChunks} Chunks</Tag>
          <Tooltip title="Refresh list">
            <Button
              type="text"
              icon={<ReloadOutlined spin={isLoadingDocs} />}
              onClick={loadDocuments}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Professional Paginated Table */}
      <Table
        dataSource={filteredDocs}
        columns={columns}
        rowKey="fileName"
        size="small"
        loading={isLoadingDocs}
        pagination={{
          pageSize: 6,
          size: "small",
          showTotal: (total) => `Total ${total} documents`,
        }}
        locale={{ emptyText: "No documents found." }}
        style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #f0f0f0" }}
      />
    </div>
  );
};

export default KnowledgeTableManager;
