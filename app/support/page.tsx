"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  ChevronLeft,
  ChevronRight,
  Send,
  Bot,
  User,
  Paperclip,
  MoreHorizontal,
  RefreshCw,
  MessageSquare,
  Plus,
  X,
  Clock,
  Trash2,
  AlertTriangle,
  Filter,
  CheckCircle2,
  HelpCircle,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AppLayout } from "@/components/layout/app-layout"
import { 
  getConversations, 
  getConversation, 
  createConversation, 
  updateConversation, 
  deleteConversation as apiDeleteConversation,
  sendMessage
} from "@/lib/api/conversations"
import { ConversationContext } from "@prisma/client"

interface ChatMessage {
  id: string
  role: "USER" | "ASSISTANT" | "SYSTEM"
  content: string
  createdAt: string
  context?: any
  messageType?: string
}

interface ChatConversation {
  id: string
  title: string
  context: ConversationContext
  isActive: boolean
  lastMessageAt: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard", href: "/" },
  { icon: Truck, label: "Vehicles", href: "/vehicles" },
  { icon: Search, label: "Parts Search", href: "/parts" },
  { icon: Users, label: "Suppliers", href: "/suppliers" },
  { icon: Package, label: "Orders", href: "/orders" },
  { icon: Wrench, label: "Maintenance", href: "/maintenance" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: HelpCircle, label: "Support", active: true, href: "/support" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

const quickActions = [
  { label: "Order Status", icon: Package },
  { label: "Account Issues", icon: User },
  { label: "Technical Help", icon: Wrench },
  { label: "Contact Sales", icon: Phone },
]

const supportResources = [
  { title: "Knowledge Base", description: "Browse our help articles", icon: FileText, link: "/kb" },
  { title: "Email Support", description: "support@example.com", icon: Mail, link: "mailto:support@example.com" },
  { title: "Phone Support", description: "+1 (555) 123-4567", icon: Phone, link: "tel:+15551234567" },
  { title: "User Guide", description: "Download PDF manual", icon: ExternalLink, link: "/guide.pdf" },
]

export default function CustomerSupportPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Fetch conversations on page load
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true)
        const response = await getConversations()
        
        // Filter for customer support conversations only
        const supportConversations = response.data.filter(
          (conv: ChatConversation) => conv.context === ConversationContext.CUSTOMER_SUPPORT
        )
        
        if (supportConversations.length > 0) {
          setConversations(supportConversations)
          
          // Load the most recent conversation
          const mostRecent = supportConversations[0]
          setCurrentConversationId(mostRecent.id)
          await loadConversationData(mostRecent.id)
        } else {
          // No conversations found, we'll create one when needed
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error fetching conversations:", error)
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [])

  // Load conversation data (messages)
  const loadConversationData = async (conversationId: string) => {
    try {
      setIsLoading(true)
      
      // Get conversation details with messages
      const conversationResponse = await getConversation(conversationId)
      const conversation = conversationResponse.data
      
      if (conversation) {
        // Set messages and parse context if available
        const processedMessages = conversation.messages.map((msg: any) => {
          let context = undefined;
          
          if (msg.context) {
            try {
              // Parse context if it's a string
              context = typeof msg.context === 'string'
                ? JSON.parse(msg.context)
                : msg.context;
            } catch (e) {
              console.error("Error parsing message context:", e);
            }
          }
          
          return {
            ...msg,
            context
          };
        });
        
        setMessages(processedMessages)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error("Error loading conversation data:", error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentConversationId) return

    // Create a temporary message to show immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: inputMessage,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempUserMessage])
    setInputMessage("")
    setIsTyping(true)

    try {
      // Send the message to the API
      const response = await sendMessage(currentConversationId, {
        content: inputMessage,
      })

      // Replace the temporary message with the actual one and add the AI response
      if (response.data) {
        setMessages((prev) => [
          ...prev.filter(m => m.id !== tempUserMessage.id),
          response.data.userMessage,
          response.data.aiResponse
        ])
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Keep the temporary message but show an error
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "SYSTEM",
          content: "Error sending message. Please try again.",
          createdAt: new Date().toISOString(),
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const createNewConversation = async () => {
    try {
      // Create a new conversation for customer support
      const response = await createConversation({
        title: `Support Request - ${new Date().toLocaleDateString()}`,
        context: ConversationContext.CUSTOMER_SUPPORT,
      })

      if (response.data) {
        const newConversation = response.data
        
        // Add the new conversation to the list
        setConversations((prev) => [newConversation, ...prev])
        
        // Set as current conversation
        setCurrentConversationId(newConversation.id)
        
        // Load the conversation data
        await loadConversationData(newConversation.id)
        
        setShowChatHistory(false)
      }
    } catch (error) {
      console.error("Error creating conversation:", error)
    }
  }

  const loadConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId)
    await loadConversationData(conversationId)
    setShowChatHistory(false)
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      // Delete the conversation from the API
      await apiDeleteConversation(conversationId)
      
      // Remove from local state
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId))
      
      // If this was the current conversation, create a new one
      if (currentConversationId === conversationId) {
        createNewConversation()
      }
    } catch (error) {
      console.error("Error deleting conversation:", error)
    }
  }

  return (
    <AppLayout activeRoute="/support">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-white">Customer Support</h1>
              <p className="text-sm text-slate-400">
                Get help with your account, orders, or technical issues
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
                onClick={() => setShowChatHistory(!showChatHistory)}
              >
                <Clock className="w-3 h-3 mr-1" />
                <span className="text-xs">History</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
                onClick={createNewConversation}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                <span className="text-xs">New Chat</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
            <Card className="lg:col-span-3 bg-slate-800 border-slate-700 flex flex-col min-h-0">
              <CardHeader className="border-b border-slate-700 flex-shrink-0 py-2 px-3">
                <CardTitle className="text-white flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  Customer Support Chat
                  {currentConversationId && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-600 text-white text-xs ml-2">
                        {conversations.find((c) => c.id === currentConversationId)?.title || "Active"}
                      </Badge>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden">
                {showChatHistory && (
                  <div className="absolute inset-0 bg-slate-800 z-10 flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">Support History</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowChatHistory(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-2">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              currentConversationId === conversation.id
                                ? "bg-blue-600 text-white"
                                : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                            }`}
                            onClick={() => loadConversation(conversation.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{conversation.title}</div>
                                <div className="text-xs opacity-75 truncate mt-1">
                                  {new Date(conversation.lastMessageAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="text-xs opacity-60">
                                    {new Date(conversation.createdAt).toLocaleDateString()}
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {conversation.messageCount} messages
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 ml-2"
                                onClick={(e) => deleteConversation(conversation.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : !currentConversationId ? (
                  <div className="flex-1 flex items-center justify-center flex-col p-6">
                    <HelpCircle className="h-16 w-16 text-blue-500 mb-4 opacity-50" />
                    <h3 className="text-white text-lg font-medium mb-2">How can we help you today?</h3>
                    <p className="text-slate-400 text-center mb-6 max-w-md">
                      Start a new conversation with our support team to get help with your account, orders, or technical issues.
                    </p>
                    <Button 
                      onClick={createNewConversation}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0 p-3">
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${message.role === "USER" ? "justify-end" : "justify-start"}`}
                        >
                          {message.role === "ASSISTANT" && (
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-blue-600 text-white">
                                <Bot className="w-3 h-3" />
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div className="flex flex-col gap-2">
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                message.role === "USER" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-100"
                              }`}
                            >
                              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                              <div
                                className={`text-xs mt-1 ${message.role === "USER" ? "text-blue-100" : "text-slate-400"}`}
                              >
                                {new Date(message.createdAt).toLocaleTimeString()}
                              </div>
                            </div>

                            {message.role === "ASSISTANT" && message.context?.suggestedActions && (
                              <div className="flex flex-wrap gap-2">
                                {message.context.suggestedActions.map((action: any, index: number) => (
                                  <Button
                                    key={index}
                                    size="sm"
                                    variant="outline"
                                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                                    onClick={() => setInputMessage(action.description)}
                                  >
                                    {action.description}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>

                          {message.role === "USER" && (
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-slate-600 text-white">
                                <User className="w-3 h-3" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ))}

                      {isTyping && (
                        <div className="flex gap-2 justify-start">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="bg-blue-600 text-white">
                              <Bot className="w-3 h-3" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-slate-700 rounded-lg p-3">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                              <div
                                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              ></div>
                              <div
                                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={messagesEndRef} />
                  </ScrollArea>
                )}

                <div className="p-3 border-t border-slate-700 flex-shrink-0">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        ref={textareaRef}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your question or describe your issue..."
                        className="min-h-[50px] bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 resize-none text-sm"
                        rows={2}
                        disabled={!currentConversationId || isLoading}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-1 right-1 text-slate-400 hover:bg-slate-600"
                      >
                        <Paperclip className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isTyping || !currentConversationId}
                      className="bg-blue-600 hover:bg-blue-700 text-white self-end"
                      size="sm"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="p-3">
                <CardTitle className="text-white text-xs font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => {
                        if (!currentConversationId) {
                          createNewConversation().then(() => {
                            setInputMessage(action.label);
                          });
                        } else {
                          setInputMessage(action.label);
                        }
                      }}
                    >
                      <action.icon className="w-3 h-3" />
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-white mb-2">Support Resources</h4>
                  <div className="space-y-3">
                    {supportResources.map((resource, index) => (
                      <Link href={resource.link} key={index}>
                        <div className="bg-slate-700 rounded-lg p-2 hover:bg-slate-600 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-600 rounded-full p-1">
                              <resource.icon className="w-3 h-3 text-white" />
                            </div>
                            <div>
                              <div className="text-xs font-medium text-white">{resource.title}</div>
                              <div className="text-xs text-slate-400">{resource.description}</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-white mb-2">Support Hours</h4>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Monday - Friday:</span>
                      <span>9:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday:</span>
                      <span>10:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday:</span>
                      <span>Closed</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-white mb-2">AI Support Capabilities</h4>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>• Account management help</div>
                    <div>• Order status inquiries</div>
                    <div>• Technical troubleshooting</div>
                    <div>• Product information</div>
                    <div>• Billing assistance</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
    </AppLayout>
  )
}