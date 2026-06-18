import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button, Input, Space, Tooltip } from "antd";
import {
  AudioOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import Speech from "speak-tts";

const { Search } = Input;
const DOMAIN = "http://localhost:5001";

const searchWrapperStyle = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
};

const searchInnerContainer = {
  width: "100%",
  maxWidth: "880px",
  margin: "0 auto",
  display: "flex",
  justifyContent: "center",
};

const ChatComponent = (props) => {
  const { handleResp, isLoading, setIsLoading } = props;
  const [searchValue, setSearchValue] = useState("");
  const [isChatModeOn, setIsChatModeOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speech, setSpeech] = useState(null);

  const {
    transcript,
    listening,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    const initialized_speech = new Speech();
    initialized_speech
      .init({
        volume: 1,
        lang: "en-US",
        rate: 1,
        pitch: 1,
        voice: "Google US English",
        splitSentences: false,
      })
      .then((data) => {
        setSpeech(initialized_speech);
      })
      .catch((e) => {
        console.error("Speech init error:", e);
      });
  }, []);

  useEffect(() => {
    if (!listening && Boolean(transcript)) {
      (async () => await onSearch(transcript))();
      setIsRecording(false);
    }
  }, [listening, transcript]);

  const talk = (what2say) => {
    if (!speech) return;

    speech.cancel();
    setIsSpeaking(true);

    speech
      .speak({
        text: what2say,
        queue: false,
        listeners: {
          onstart: () => {
            setIsSpeaking(true);
          },
          onend: () => {
            setIsSpeaking(false);
          },
        },
      })
      .then(() => {
        setIsSpeaking(false);
        userStartConvo();
      })
      .catch((e) => {
        setIsSpeaking(false);
      });
  };

  const stopSpeaking = () => {
    if (speech) {
      speech.cancel();
      setIsSpeaking(false);
    }
  };

  const userStartConvo = () => {
    SpeechRecognition.startListening();
    setIsRecording(true);
    resetTranscript();
  };

  const chatModeClickHandler = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setIsChatModeOn(!isChatModeOn);
    setIsRecording(false);
    SpeechRecognition.stopListening();
    resetTranscript();
  };

  const recordingClickHandler = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    if (isRecording) {
      setIsRecording(false);
      SpeechRecognition.stopListening();
      resetTranscript();
    } else {
      setIsRecording(true);
      SpeechRecognition.startListening();
    }
  };

  const onSearch = async (question) => {
    if (!question || !question.trim()) return;

    if (isSpeaking) {
      stopSpeaking();
    }

    setSearchValue("");
    setIsLoading(true);

    try {
      const response = await axios.get(`${DOMAIN}/chat`, {
        params: { question },
      });

      handleResp(question, response.data);

      if (isChatModeOn) {
        const textToSpeak =
          response?.data?.answer ||
          response?.data?.ragAnswer ||
          response?.data?.mcpAnswer;
        if (textToSpeak) {
          talk(textToSpeak);
        }
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      handleResp(question, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setSearchValue(e.target.value);
  };

  return (
    <div style={searchWrapperStyle}>
      <div style={searchInnerContainer}>
        {!isChatModeOn ? (
          /* Normal Text Mode */
          <Space.Compact style={{ width: "100%" }}>
            <Search
              placeholder="Ask anything (searches private documents or live web)..."
              enterButton="Ask OmniAgent"
              size="large"
              onSearch={onSearch}
              loading={isLoading}
              value={searchValue}
              onChange={handleChange}
            />
            <Button
              type="default"
              size="large"
              icon={<AudioOutlined style={{ color: "#1677ff" }} />}
              onClick={chatModeClickHandler}
              style={{ fontWeight: "500" }}
            >
              Voice Mode
            </Button>
          </Space.Compact>
        ) : (
          /* Voice Chat Mode (Anchored & Centered) */
          <Space.Compact style={{ width: "100%" }}>
            <Input
              size="large"
              readOnly
              value={
                isRecording
                  ? transcript || "Listening... Speak your question now"
                  : isSpeaking
                  ? "OmniAgent is speaking... Click 'Stop Speaking' to pause"
                  : "Voice Mode Active. Click 'Speak' to start speaking."
              }
              prefix={<AudioOutlined style={{ color: isRecording ? "#ff4d4f" : "#1677ff" }} />}
              style={{
                backgroundColor: isRecording ? "#fff2f0" : "#f6ffed",
                borderColor: isRecording ? "#ffccc7" : "#b7eb8f",
                color: "#262626",
                fontWeight: "500",
              }}
            />

            <Button
              type="primary"
              size="large"
              danger={isRecording}
              icon={<AudioOutlined />}
              onClick={recordingClickHandler}
              style={{ minWidth: "120px" }}
            >
              {isRecording ? "Listening..." : "Speak"}
            </Button>

            {isSpeaking && (
              <Tooltip title="Stop speech playback">
                <Button
                  type="primary"
                  danger
                  size="large"
                  icon={<PauseCircleOutlined />}
                  onClick={stopSpeaking}
                >
                  Stop Speaking
                </Button>
              </Tooltip>
            )}

            <Button
              size="large"
              icon={<CloseCircleOutlined />}
              onClick={chatModeClickHandler}
            >
              Exit Voice
            </Button>
          </Space.Compact>
        )}
      </div>
    </div>
  );
};

export default ChatComponent;
