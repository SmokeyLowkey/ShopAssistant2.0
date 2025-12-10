
"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
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
  ShoppingCart,
  Clock,
  Trash2,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Image as ImageIcon,
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
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel"
import { AppLayout } from "@/components/layout/app-layout"
import { getVehicles, Vehicle } from "@/lib/api/vehicles"
import { 
  getConversations, 
  getConversation, 
  createConversation, 
  updateConversation, 
  deleteConversation as apiDeleteConversation,
  sendMessage,
  getConversationMessages
} from "@/lib/api/conversations"
import {
  getPickList,
  getPickListItems,
  addPickListItem,
  updatePickListItem,
  deletePickListItem
} from "@/lib/api/picklists"
import { ConversationContext } from "@prisma/client"
import { useCallback } from "react"

interface ChatMessage {
  id: string
  role: "USER" | "ASSISTANT" | "SYSTEM"
  content: string
  createdAt: string
  partNumber?: string
  context?: any
  messageType?: string
}

interface PickListItem {
  id: string
  partNumber: string
  description: string
  estimatedPrice?: number
  quantity: number
  isOrdered: boolean
  price?: number // For backward compatibility with UI
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
  pickListId?: string
}

interface VehicleContext {
  id: string
  vehicleId: string
  make: string
  model: string
  year: number
  type: string
  serialNumber?: string
}

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard", href: "/" },
  { icon: Truck, label: "Vehicles", href: "/vehicles" },
  { icon: Search, label: "Parts Search", active: true, href: "/parts" },
  { icon: Users, label: "Suppliers", href: "/suppliers" },
  { icon: Package, label: "Orders", href: "/orders" },
  { icon: Wrench, label: "Maintenance", href: "/maintenance" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

const quickActions = [
  { label: "Find Compatible Parts", icon: Search },
  { label: "Check Stock Levels", icon: Package },
  { label: "Get Price Quote", icon: MoreHorizontal },
  { label: "Technical Specs", icon: FileText },
]

// Helper function to consolidate duplicate messages within a time window
const consolidateMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const consolidated: ChatMessage[] = [];
  const TIME_WINDOW_MS = 120000; // 120 seconds - wide window for n8n parallel execution
  const processed = new Set<string>();
  
  for (let i = 0; i < messages.length; i++) {
    const currentMsg = messages[i];
    
    // Skip if already processed
    if (processed.has(currentMsg.id)) continue;
    
    // For ASSISTANT messages, check for duplicates
    if (currentMsg.role === "ASSISTANT") {
      const msgTime = new Date(currentMsg.createdAt).getTime();
      const duplicates: ChatMessage[] = [currentMsg];
      processed.add(currentMsg.id);
      
      // Find all duplicates within the time window
      // Match by: same conversationId, same role, similar timestamp, and similar content pattern
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        const nextTime = new Date(nextMsg.createdAt).getTime();
        const timeDiff = Math.abs(nextTime - msgTime);
        
        if (
          nextMsg.role === "ASSISTANT" &&
          !processed.has(nextMsg.id) &&
          timeDiff < TIME_WINDOW_MS
        ) {
          // Check if messages are duplicates based on multiple criteria:
          // 1. Exact same content (template message from n8n)
          const sameContent = nextMsg.content === currentMsg.content;
          
          // 2. Similar content structure (e.g., "I found X parts matching...")
          const contentPattern = /I found \d+ parts matching your search for/;
          const similarPattern = contentPattern.test(currentMsg.content) && 
                                contentPattern.test(nextMsg.content);
          
          // 3. Both have search results in context
          const bothHaveResults = currentMsg.context?.searchResults && 
                                 nextMsg.context?.searchResults;
          
          // 4. Very close timestamps (within 2 minutes indicates n8n parallel execution)
          const veryCloseTime = timeDiff < 120000;
          
          // Group if ANY of these conditions match + close timing
          if (veryCloseTime && (sameContent || similarPattern || bothHaveResults)) {
            duplicates.push(nextMsg);
            processed.add(nextMsg.id);
          }
        }
      }
      
      // Store all duplicates for carousel display
      if (duplicates.length > 1) {
        console.log(`[Consolidation] Found ${duplicates.length} duplicate messages for content: "${currentMsg.content.substring(0, 60)}..."`);
        const primaryMessage = {
          ...currentMsg,
          context: {
            ...currentMsg.context,
            _duplicates: duplicates, // Store all duplicate messages
            _duplicateCount: duplicates.length,
          }
        };
        consolidated.push(primaryMessage);
      } else {
        consolidated.push(currentMsg);
      }
    } else {
      // For USER messages, just add as-is
      processed.add(currentMsg.id);
      consolidated.push(currentMsg);
    }
  }
  
  console.log(`[Consolidation] Processed ${messages.length} messages into ${consolidated.length} consolidated messages`);
  return consolidated;
};

// Helper function to extract part numbers from message content
const extractPartNumbers = (content: string): string[] => {
  // Look for part numbers that follow specific patterns
  const patterns = [
    // Match "Part Number: XXXXX" pattern
    /Part Number:\s*([A-Z0-9]+-?[0-9]+[A-Z0-9]*)/gi,
    
    // Match "Part X: XXXXX" pattern (where X is a number or letter)
    /Part\s+(?:\d+|[A-Z]):\s*([A-Z0-9]+-?[0-9]+[A-Z0-9]*)/gi,
    
    // Match "**Part X:** XXXXX" pattern (markdown format)
    /\*\*Part\s+(?:\d+|[A-Z]):\*\*\s*([A-Z0-9]+-?[0-9]+[A-Z0-9]*)/gi,
    
    // Match "📦 **XXXXX**" pattern (from our formatted messages)
    /📦\s*\*\*([A-Z0-9]+-?[0-9]+[A-Z0-9]*)\*\*/gi
  ];
  
  // Extract part numbers using each pattern
  const partNumbers: string[] = [];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        partNumbers.push(match[1]);
      }
    }
  });
  
  // Also check for part numbers in context data
  if (content.includes("partNumber") || content.includes("part number")) {
    const contextMatch = /(?:partNumber|part number)["']?\s*:\s*["']?([A-Z0-9]+-?[0-9]+[A-Z0-9]*)["']?/gi.exec(content);
    if (contextMatch && contextMatch[1]) {
      partNumbers.push(contextMatch[1]);
    }
  }
  
  // Return unique part numbers
  return [...new Set(partNumbers)];
};

export default function PartsSearchPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed')
      return saved === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [pickList, setPickList] = useState<PickListItem[]>([])
  const [pickListId, setPickListId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({})
  
  // Quote request context state
  const [hasHandledQuoteRequest, setHasHandledQuoteRequest] = useState(false)
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null)
  const [isLoadingQuoteContext, setIsLoadingQuoteContext] = useState(false)
  const isProcessingQuoteRef = useRef(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Helper component to render message context (search results, insights, etc.)
  const MessageContextDisplay = ({ context, addToPickListFunc, setInputMsgFunc }: { 
    context: any, 
    addToPickListFunc: (partNumber: string, partDetails?: any) => void,
    setInputMsgFunc: (msg: string) => void
  }) => (
    <div className="mt-3 space-y-3 border-t border-slate-600 pt-3">
      {/* Display Search Results */}
      {context.searchResults && context.searchResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-orange-400">Parts Found:</h4>
          {context.searchResults.map((part: any, idx: number) => (
            <div key={idx} className="bg-slate-800 rounded p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2 flex-1">
                  <div className="flex-shrink-0">
                    {part.imageUrl ? (
                      <a 
                        href={part.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block w-12 h-12 bg-slate-700 rounded border border-slate-600 hover:border-orange-500 transition-colors overflow-hidden"
                      >
                        <img 
                          src={part.imageUrl} 
                          alt={part.partNumber}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="w-12 h-12 bg-slate-700 rounded border border-slate-600 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-orange-400">
                      📦 {part.partNumber}
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      {part.description}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {part.price > 0 ? `$${part.price.toFixed(2)}` : 'Price TBD'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {part.availability}
                  </div>
                </div>
              </div>

              {/* Compatibility */}
              {part.compatibility && part.compatibility.length > 0 && (
                <div className="text-xs">
                  <span className="text-slate-400">Compatible: </span>
                  <span className="text-green-400">
                    {part.compatibility.join(', ')}
                  </span>
                </div>
              )}

              {/* Match Confidence */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${part.matchConfidence}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {part.matchConfidence}% match
                </span>
              </div>

              {/* Action Buttons */}
              {part.partNumber && (
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => addToPickListFunc(part.partNumber, part)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add to Pick List
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Display Agent Insights */}
      {context.agent_insights && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-blue-400">AI Insights:</h4>
          
          {context.agent_insights.database && context.agent_insights.database.answer && (
            <details className="bg-slate-800 rounded p-2">
              <summary className="text-xs cursor-pointer text-slate-300">
                Database Search ({Math.round((context.agent_insights.database.confidence || 0) * 100)}% confidence)
              </summary>
              <div className="text-xs text-slate-400 mt-2 whitespace-pre-wrap">
                {typeof context.agent_insights.database.answer === 'string' 
                  ? context.agent_insights.database.answer 
                  : JSON.stringify(context.agent_insights.database.answer, null, 2)}
              </div>
            </details>
          )}

          {context.agent_insights.graph_rag && context.agent_insights.graph_rag.answer && (
            <details className="bg-slate-800 rounded p-2">
              <summary className="text-xs cursor-pointer text-slate-300">
                Graph RAG ({Math.round((context.agent_insights.graph_rag.confidence || 0) * 100)}% confidence)
              </summary>
              <div className="text-xs text-slate-400 mt-2 whitespace-pre-wrap">
                {typeof context.agent_insights.graph_rag.answer === 'string' 
                  ? context.agent_insights.graph_rag.answer 
                  : JSON.stringify(context.agent_insights.graph_rag.answer, null, 2)}
              </div>
            </details>
          )}

          {context.agent_insights.hybrid_rag && context.agent_insights.hybrid_rag.answer && (
            <details className="bg-slate-800 rounded p-2">
              <summary className="text-xs cursor-pointer text-slate-300">
                Hybrid RAG ({Math.round((context.agent_insights.hybrid_rag.confidence || 0) * 100)}% confidence)
              </summary>
              <div className="text-xs text-slate-400 mt-2 whitespace-pre-wrap">
                {typeof context.agent_insights.hybrid_rag.answer === 'string' 
                  ? context.agent_insights.hybrid_rag.answer 
                  : JSON.stringify(context.agent_insights.hybrid_rag.answer, null, 2)}
              </div>
              
              {/* Display similar_parts if available */}
              {context.agent_insights.hybrid_rag.similar_parts && Array.isArray(context.agent_insights.hybrid_rag.similar_parts) && context.agent_insights.hybrid_rag.similar_parts.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-700">
                  <div className="text-xs font-semibold text-cyan-400 mb-2">Similar Parts Found:</div>
                  <div className="space-y-2">
                    {context.agent_insights.hybrid_rag.similar_parts.map((part: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 rounded p-2 space-y-1">
                        <div className="font-semibold text-orange-400">
                          📦 {part.part_number}
                        </div>
                        <div className="text-slate-300">{part.part_title}</div>
                        {part.why_similar && (
                          <div className="text-slate-400 italic text-xs">
                            ✓ {part.why_similar}
                          </div>
                        )}
                        {part.similarity_score && (
                          <div className="text-xs text-green-400">
                            Match Score: {part.similarity_score.toFixed(2)}
                          </div>
                        )}
                        {part.compatibility_notes && (
                          <div className="text-xs text-yellow-400">
                            ⚠️ {part.compatibility_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {context.agent_insights.hybrid_rag.recommendations && (
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-700 space-y-2">
                  <div className="font-semibold text-slate-300">Recommendations:</div>
                  {typeof context.agent_insights.hybrid_rag.recommendations === 'string' ? (
                    <p className="italic">{context.agent_insights.hybrid_rag.recommendations}</p>
                  ) : (
                    <div className="space-y-1">
                      {context.agent_insights.hybrid_rag.recommendations.primary_choice && (
                        <div>
                          <span className="font-medium text-green-400">Primary Choice:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.primary_choice}</p>
                        </div>
                      )}
                      {context.agent_insights.hybrid_rag.recommendations.alternative_options && (
                        <div>
                          <span className="font-medium text-blue-400">Alternatives:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.alternative_options}</p>
                        </div>
                      )}
                      {context.agent_insights.hybrid_rag.recommendations.alternatives && (
                        <div>
                          <span className="font-medium text-blue-400">Alternatives:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.alternatives}</p>
                        </div>
                      )}
                      {context.agent_insights.hybrid_rag.recommendations.cross_brand_note && (
                        <div>
                          <span className="font-medium text-yellow-400">Note:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.cross_brand_note}</p>
                        </div>
                      )}
                      {context.agent_insights.hybrid_rag.recommendations.compatibility_warnings && (
                        <div>
                          <span className="font-medium text-orange-400">⚠️ Warning:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.compatibility_warnings}</p>
                        </div>
                      )}
                      {context.agent_insights.hybrid_rag.recommendations.considerations && (
                        <div>
                          <span className="font-medium text-purple-400">Considerations:</span>
                          <p className="ml-2">{context.agent_insights.hybrid_rag.recommendations.considerations}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </details>
          )}
        </div>
      )}

      {/* Display Suggested Next Steps */}
      {context.conversationNextSteps && context.conversationNextSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-purple-400">Suggested Next Steps:</h4>
          <ul className="text-xs text-slate-300 space-y-1">
            {context.conversationNextSteps.map((step: string, idx: number) => (
              <li key={idx} className="flex gap-2">
                <span className="text-purple-400">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display Related Queries */}
      {context.relatedQueries && context.relatedQueries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-cyan-400">Related Searches:</h4>
          <div className="flex flex-wrap gap-2">
            {context.relatedQueries.map((query: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setInputMsgFunc(query)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-1 rounded border border-cyan-600/30"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display Metadata */}
      {context.metadata && (
        <div className="text-xs text-slate-500 border-t border-slate-600 pt-2 mt-2">
          <div className="flex justify-between">
            <span>Execution: {context.metadata.execution_mode}</span>
            <span>Time: {context.metadata.execution_time_ms}ms</span>
            <span>Confidence: {Math.round((context.metadata.confidence || 0) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const searchParams = useSearchParams()

  // State for vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleContext | null>(null)
  const [showVehicleSelector, setShowVehicleSelector] = useState(false)

  // Fetch vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoadingVehicles(true)
        const response = await getVehicles()
        setVehicles(response.data)
      } catch (error) {
        console.error("Error fetching vehicles:", error)
      } finally {
        setLoadingVehicles(false)
      }
    }

    fetchVehicles()
  }, [])

  // Effect to handle quote request context - runs ONCE when page loads with quoteRequestId
  useEffect(() => {
    const handleQuoteRequestContext = async () => {
      const qrId = searchParams.get('quoteRequestId')
      
      // Only handle if there's a quoteRequestId in URL and we haven't handled it yet
      if (!qrId || hasHandledQuoteRequest || vehicles.length === 0 || isProcessingQuoteRef.current) {
        return
      }
      
      console.log('[Quote Flow] Handling quote request:', qrId)
      isProcessingQuoteRef.current = true
      setQuoteRequestId(qrId)
      setIsLoadingQuoteContext(true)
      setHasHandledQuoteRequest(true) // Mark as handled immediately
      
      try {
        // Fetch the quote request
        const qrResponse = await fetch(`/api/quote-requests/${qrId}`)
        const qrData = await qrResponse.json()
        
        if (!qrData.data) {
          console.error('[Quote Flow] Quote request not found')
          router.replace('/parts')
          setIsLoadingQuoteContext(false)
          return
        }
        
        const quoteRequest = qrData.data
        
        // MANDATORY: Quote request must have a vehicle
        if (!quoteRequest.vehicleId) {
          console.error('[Quote Flow] Quote request has no vehicle - this should not happen!')
          alert('This quote request needs a vehicle assigned. Please edit the quote request and select a vehicle first.')
          router.replace(`/orders/quote-request/${qrId}/edit`)
          setIsLoadingQuoteContext(false)
          return
        }
        
        // Set vehicle context from quote request
        const vehicle = vehicles.find(v => v.id === quoteRequest.vehicleId)
        
        if (!vehicle) {
          console.error('[Quote Flow] Vehicle not found:', quoteRequest.vehicleId)
          alert('Vehicle not found. Please refresh and try again.')
          router.replace('/parts')
          setIsLoadingQuoteContext(false)
          return
        }
        
        // Set the vehicle context WITHOUT showing the selector
        setSelectedVehicle({
          id: vehicle.id,
          vehicleId: vehicle.vehicleId,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          type: vehicle.type,
        })
        
        console.log('[Quote Flow] Set vehicle context:', vehicle.vehicleId)
        
        // Check if quote request already has a pickListId
        if (quoteRequest.pickListId) {
          // Try to find the pick list
          try {
            const pickListResponse = await getPickList(quoteRequest.pickListId)
            
            if (pickListResponse.data) {
              const pickList = pickListResponse.data
              
              // Fetch all conversations to find the one with this pick list
              const conversationsResponse = await getConversations()
              if (conversationsResponse.data) {
                setConversations(conversationsResponse.data)
                
                const conversationWithPickList = conversationsResponse.data.find(
                  (c: ChatConversation) => c.pickListId === pickList.id
                )
                
                if (conversationWithPickList) {
                  // Load existing conversation
                  console.log('[Quote Flow] Found existing conversation:', conversationWithPickList.id)
                  setCurrentConversationId(conversationWithPickList.id)
                  await loadConversationData(conversationWithPickList.id)
                  
                  // Clear the quoteRequestId from URL and replace with conversationId
                  router.replace(`/parts?conversation=${conversationWithPickList.id}`)
                  setHasHandledQuoteRequest(true)
                  setIsLoadingQuoteContext(false)
                  return
                } else {
                  // Pick list exists but no conversation - this shouldn't happen, create new one
                  console.log('[Quote Flow] Pick list exists but no conversation, creating new one')
                  await createConversationForQuote(quoteRequest, vehicle)
                  return
                }
              }
            }
          } catch (pickListError) {
            // PickList was deleted or doesn't exist - clear the pickListId and create new conversation
            console.warn('[Quote Flow] PickList not found, will create new conversation:', pickListError)
            // Note: We don't update the quote request here, createConversationForQuote will set the new pickListId
          }
        }
        
        // No pick list or pick list not found - create new conversation for this quote
        console.log('[Quote Flow] No valid pick list, creating new conversation')
        await createConversationForQuote(quoteRequest, vehicle)
      } catch (error) {
        console.error('[Quote Flow] Error loading quote request context:', error)
        router.replace('/parts')
      } finally {
        setIsLoadingQuoteContext(false)
        isProcessingQuoteRef.current = false
      }
    }
    
    if (vehicles.length > 0) {
      handleQuoteRequestContext()
    }
  }, [vehicles.length, hasHandledQuoteRequest])

  // Fetch conversations on page load
  useEffect(() => {
    const fetchConversations = async () => {
      // Skip if we're handling a quote request
      const qrId = searchParams.get('quoteRequestId')
      if (isLoadingQuoteContext || (qrId && !hasHandledQuoteRequest)) {
        console.log('[Normal Flow] Skipping - quote request being handled')
        return
      }
      
      // Check if there's a conversation ID in the URL
      const conversationParam = searchParams.get('conversation')
      
      // If we just handled a quote request and have the conversation in URL, ensure it's loaded
      if (hasHandledQuoteRequest && conversationParam && currentConversationId === conversationParam) {
        console.log('[Normal Flow] Quote flow complete, conversation already loaded')
        setIsLoading(false)
        return
      }
      
      console.log('[Normal Flow] Loading conversations normally')
      
      try {
        setIsLoading(true)
        const response = await getConversations()
        
        if (response.data && response.data.length > 0) {
          setConversations(response.data)
          
          if (conversationParam) {
            // Load the specific conversation from URL
            const conversationExists = response.data.find((c: ChatConversation) => c.id === conversationParam)
            if (conversationExists) {
              setCurrentConversationId(conversationParam)
              await loadConversationData(conversationParam)
            } else {
              // Conversation not found, load most recent
              const mostRecent = response.data[0]
              setCurrentConversationId(mostRecent.id)
              await loadConversationData(mostRecent.id)
            }
          } else {
            // Load the most recent conversation
            const mostRecent = response.data[0]
            setCurrentConversationId(mostRecent.id)
            await loadConversationData(mostRecent.id)
          }
        } else {
          // No conversations found, we'll create one when needed
          console.log('[Normal Flow] No conversations found')
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error fetching conversations:", error)
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [searchParams, isLoadingQuoteContext, hasHandledQuoteRequest, conversations.length])

  // Load conversation data (messages and pick list)
  const loadConversationData = async (conversationId: string) => {
    try {
      setIsLoading(true)
      
      // Get conversation details with messages
      const conversationResponse = await getConversation(conversationId)
      const conversation = conversationResponse.data
      
      if (conversation) {
        // Set messages and extract part numbers from context
        const processedMessages = conversation.messages.map((msg: any) => {
          // Extract part number from context if available
          let partNumber = undefined;
          let context = undefined;
          
          if (msg.context) {
            try {
              // Parse context if it's a string
              context = typeof msg.context === 'string'
                ? JSON.parse(msg.context)
                : msg.context;
                
              // Extract part number if available
              if (context.partNumber) {
                partNumber = context.partNumber;
              }
            } catch (e) {
              console.error("Error parsing message context:", e);
            }
          }
          
          return {
            ...msg,
            partNumber,
            context
          };
        });
        
        // Consolidate duplicate messages from n8n workflow
        const consolidatedMessages = consolidateMessages(processedMessages);
        
        setMessages(consolidatedMessages)
        
        // Find the pick list for this conversation
        if (conversation.pickLists && conversation.pickLists.length > 0) {
          const activePickList = conversation.pickLists.find((pl: any) => pl.status === "ACTIVE") || conversation.pickLists[0]
          
          console.log('[Load Conversation] Pick list found:', {
            pickListId: activePickList.id,
            vehicleId: activePickList.vehicleId,
            hasVehicle: !!activePickList.vehicle,
            itemCount: activePickList.items?.length || 0,
          })
          
          setPickListId(activePickList.id)
          setPickList(activePickList.items || [])
          
          // Update the selected vehicle from the pick list
          if (activePickList.vehicle) {
            console.log('[Load Conversation] Setting vehicle from pick list:', {
              id: activePickList.vehicle.id,
              vehicleId: activePickList.vehicle.vehicleId,
              make: activePickList.vehicle.make,
              model: activePickList.vehicle.model,
              year: activePickList.vehicle.year,
            })
            
            setSelectedVehicle({
              id: activePickList.vehicle.id,
              vehicleId: activePickList.vehicle.vehicleId,
              make: activePickList.vehicle.make,
              model: activePickList.vehicle.model,
              year: activePickList.vehicle.year,
              type: activePickList.vehicle.type,
            });
          } else {
            console.log('[Load Conversation] No vehicle in pick list')
          }
        } else {
          console.log('[Load Conversation] No pick lists found')
          setPickList([])
          setPickListId(null)
        }
        
        // Fallback: Find vehicle context in messages if not found in pick list
        if (!selectedVehicle) {
          // Find vehicle context in messages
          const vehicleContextMessage = processedMessages.find((msg: ChatMessage) =>
            msg.context && msg.context.vehicleId
          );
          
          if (vehicleContextMessage && vehicleContextMessage.context.vehicleId) {
            // Fetch vehicle details
            try {
              const vehicleId = vehicleContextMessage.context.vehicleId;
              const vehicle = vehicles.find(v => v.id === vehicleId);
              
              if (vehicle) {
                setSelectedVehicle({
                  id: vehicle.id,
                  vehicleId: vehicle.vehicleId,
                  make: vehicle.make,
                  model: vehicle.model,
                  year: vehicle.year,
                  type: vehicle.type,
                });
              }
            } catch (e) {
              console.error("Error setting vehicle from message context:", e);
            }
          }
        }
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

  // Poll for new messages when waiting for webhook response
  const pollForNewMessages = useCallback(async (conversationId: string, lastMessageId: string) => {
    let attempts = 0
    const maxAttempts = 25 // Poll for up to 50 seconds (25 attempts * 2 seconds)
    
    const poll = async () => {
      attempts++
      
      try {
        const response = await getConversationMessages(conversationId)
        
        if (response.data && response.data.length > 0) {
          const latestMessage = response.data[response.data.length - 1]
          
          // Check if we have a new assistant message
          if (latestMessage.id !== lastMessageId && latestMessage.role === "ASSISTANT") {
            // Parse context if needed
            const processedMessages = response.data.map((msg: any) => {
              const message = { ...msg }
              
              if (message.context && typeof message.context === 'string') {
                try {
                  message.context = JSON.parse(message.context)
                } catch (e) {
                  console.error("Failed to parse context:", e)
                }
              }
              
              return message
            })
            
            // Consolidate duplicate messages before setting state
            const consolidatedMessages = consolidateMessages(processedMessages)
            
            setMessages(consolidatedMessages)
            setIsTyping(false)
            if (pollingInterval) {
              clearInterval(pollingInterval)
              setPollingInterval(null)
            }
            return true
          }
        }
        
        if (attempts >= maxAttempts) {
          setIsTyping(false)
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
          }
          return false
        }
      } catch (error) {
        console.error("Polling error:", error)
      }
      
      return false
    }
    
    // Start polling every 5 seconds (reduced frequency to avoid UI reset issues)
    const interval = setInterval(poll, 5000)
    setPollingInterval(interval)
    
    // Also do immediate poll
    poll()
  }, [pollingInterval])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

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
    const messageContent = inputMessage
    setInputMessage("")
    setIsTyping(true)

    try {
      // Send the message to the API - this now waits up to 2.5 minutes for n8n response
      console.log('[Send Message] Waiting for n8n response (up to 2.5 minutes)...')
      const response = await sendMessage(currentConversationId, {
        content: messageContent,
      })
      console.log('[Send Message] Response received from API')

      // Replace the temporary message with the actual one and add the AI response
      if (response.data && response.data.aiResponse) {
        // Process the AI response to ensure context is properly parsed
        const aiResponse = response.data.aiResponse;
        let processedAiResponse = aiResponse;
        
        if (aiResponse && aiResponse.context) {
          try {
            // Parse context if it's a string
            const context = typeof aiResponse.context === 'string'
              ? JSON.parse(aiResponse.context)
              : aiResponse.context;
            
            processedAiResponse = {
              ...aiResponse,
              context
            };
          } catch (e) {
            console.error("Error parsing AI response context:", e);
          }
        }
        
        // Check if this is a fallback message (webhook still processing)
        const isFallbackMessage = processedAiResponse.context?.fallback === true;
        
        if (isFallbackMessage) {
          // Webhook timed out after 2.5 minutes, start polling for late response
          console.log("Received fallback message after timeout, starting polling for actual response...")
          setMessages((prev) => [
            ...prev.filter(m => m.id !== tempUserMessage.id),
            response.data.userMessage,
            processedAiResponse
          ])
          pollForNewMessages(currentConversationId, processedAiResponse.id)
        } else {
          // Got actual response within timeout, update messages
          console.log('[Send Message] Received actual AI response')
          setMessages((prev) => [
            ...prev.filter(m => m.id !== tempUserMessage.id),
            response.data.userMessage,
            processedAiResponse
          ])
          setIsTyping(false)
        }
      } else {
        // If no immediate response after 2.5 min wait, start polling
        console.log("No response after waiting, starting polling...")
        pollForNewMessages(currentConversationId, tempUserMessage.id)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      
      // Start polling as fallback only after the request fails
      console.log("Error occurred after waiting, starting polling as fallback...")
      pollForNewMessages(currentConversationId, tempUserMessage.id)
    }
  }

  const addToPickList = async (partNumberInput: string, partDetails?: any) => {
    if (!currentConversationId || !pickListId) return
    
    // Get the part number from either direct input or context
    const partNumber = partNumberInput || "";

    try {
      // Get the conversation to find its pick list
      if (!pickListId) {
        const conversationResponse = await getConversation(currentConversationId)
        const conversation = conversationResponse.data
        
        if (conversation.pickLists && conversation.pickLists.length > 0) {
          const activePickList = conversation.pickLists.find((pl: any) => pl.status === "ACTIVE") || conversation.pickLists[0]
          setPickListId(activePickList.id)
        } else {
          // No pick list found, this shouldn't happen as one is created with each conversation
          console.error("No pick list found for conversation")
          return
        }
      }

      // Find part details in the current message context if not provided
      if (!partDetails && messages.length > 0) {
        const lastAssistantMessage = [...messages].reverse().find(msg =>
          msg.role === "ASSISTANT" && msg.context && msg.context.searchResults
        );
        
        if (lastAssistantMessage && lastAssistantMessage.context && lastAssistantMessage.context.searchResults) {
          const searchResults = lastAssistantMessage.context.searchResults;
          if (searchResults.results && Array.isArray(searchResults.results)) {
            partDetails = searchResults.results.find((part: any) => part.partNumber === partNumber);
          }
        }
      }

      // Add the item to the pick list with enhanced details if available
      const response = await addPickListItem(pickListId, {
        partNumber,
        description: partDetails?.description || (partNumber === "1R-0750" ? "Hydraulic Filter" : "Construction Part"),
        estimatedPrice: partDetails?.price || (partNumber === "1R-0750" ? 89.99 : undefined),
        quantity: 1,
      })

      if (response.data) {
        // Update the local pick list
        setPickList((prev) => [...prev, response.data])
      }
    } catch (error) {
      console.error("Error adding item to pick list:", error)
    }
  }

  const removeFromPickList = async (id: string) => {
    if (!pickListId) return

    try {
      // Remove the item from the pick list
      await deletePickListItem(pickListId, id)
      
      // Update the local pick list
      setPickList((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.error("Error removing item from pick list:", error)
    }
  }

  const updateQuantity = async (id: string, quantity: number) => {
    if (!pickListId) return

    if (quantity <= 0) {
      removeFromPickList(id)
      return
    }
    
    try {
      // Update the item quantity
      const response = await updatePickListItem(pickListId, id, { quantity })
      
      if (response.data) {
        // Update the local pick list
        setPickList((prev) => 
          prev.map((item) => (item.id === id ? { ...item, quantity } : item))
        )
      }
    } catch (error) {
      console.error("Error updating item quantity:", error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Create conversation for quote request that has no pickList
  const createConversationForQuote = async (quoteRequest: any, vehicle: VehicleContext) => {
    try {
      console.log('[Quote Flow] Creating new conversation for quote request:', quoteRequest.id)
      
      // Create a new conversation with the vehicle context
      const conversationResponse = await createConversation({
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model} - Quote Request #${quoteRequest.id}`,
        context: ConversationContext.PARTS_SEARCH,
        vehicleId: vehicle.id,
      })

      if (!conversationResponse.data) {
        throw new Error('Failed to create conversation')
      }

      const newConversation = conversationResponse.data
      console.log('[Quote Flow] Created conversation:', newConversation.id)

      // Get the pickList from the conversation response
      if (!newConversation.pickList || !newConversation.pickList.id) {
        throw new Error('No pickList found in conversation response')
      }

      const pickList = newConversation.pickList
      console.log('[Quote Flow] Found pickList:', pickList.id)

      // Update the quote request with the pickListId using PATCH
      const updateResponse = await fetch(`/api/quote-requests/${quoteRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickListId: pickList.id }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update quote request with pickListId')
      }

      console.log('[Quote Flow] Updated quote request with pickListId')

      // Add existing quote request items to the pickList
      if (quoteRequest.items && quoteRequest.items.length > 0) {
        for (const item of quoteRequest.items) {
          if (item.partNumber) {
            try {
              await addPickListItem(pickList.id, {
                partNumber: item.partNumber,
                description: item.description || '',
                quantity: item.quantity || 1,
                estimatedPrice: item.estimatedPrice,
              })
            } catch (error) {
              console.error('[Quote Flow] Error adding item to pickList:', error)
            }
          }
        }
        console.log('[Quote Flow] Added items to pickList')
      }

      // Add the new conversation to the list
      setConversations((prev) => [newConversation, ...prev])
      
      // Set as current conversation and load its data
      setCurrentConversationId(newConversation.id)
      await loadConversationData(newConversation.id)
      
      // Add a local system message (no webhook call) explaining the context
      const systemMessage = {
        id: `system-${Date.now()}`,
        role: 'SYSTEM' as const,
        content: `This conversation was automatically created from Quote Request #${quoteRequest.id}. The parts you requested have been added to your pick list. You can continue searching for additional parts or discuss your requirements.`,
        messageType: 'TEXT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, systemMessage])
      
      // Clear URL parameter and update with conversation ID
      router.replace(`/parts?conversation=${newConversation.id}`)
      
      // Mark quote request handling as complete
      setHasHandledQuoteRequest(true)
      setIsLoadingQuoteContext(false)
      
      console.log('[Quote Flow] Successfully loaded conversation for quote request')
    } catch (error) {
      console.error('[Quote Flow] Error creating conversation for quote:', error)
      setIsLoadingQuoteContext(false)
      setHasHandledQuoteRequest(true)
      
      // Redirect to edit page on error
      router.replace(`/orders/quote-request/${quoteRequest.id}/edit`)
    }
  }

  const createNewConversation = async (vehicle?: VehicleContext) => {
    const vehicleToUse = vehicle || selectedVehicle
    
    if (!vehicleToUse) {
      console.log('[New Chat Flow] No vehicle selected, showing selector')
      setShowVehicleSelector(true)
      return
    }

    console.log('[New Chat Flow] Creating conversation for vehicle:', {
      id: vehicleToUse.id,
      vehicleId: vehicleToUse.vehicleId,
      make: vehicleToUse.make,
      model: vehicleToUse.model,
    })
    
    try {
      // Create a new conversation with the selected vehicle
      const response = await createConversation({
        title: `${vehicleToUse.year} ${vehicleToUse.make} ${vehicleToUse.model} Parts`,
        context: ConversationContext.PARTS_SEARCH,
        vehicleId: vehicleToUse.id,
      })

      if (response.data) {
        const newConversation = response.data
        
        console.log('[New Chat Flow] Conversation created:', {
          conversationId: newConversation.id,
          pickListId: newConversation.pickList?.id,
          pickListVehicleId: newConversation.pickList?.vehicleId,
        })
        
        // Add the new conversation to the list
        setConversations((prev) => [newConversation, ...prev])
        
        // Set as current conversation
        setCurrentConversationId(newConversation.id)
        
        // Load the conversation data
        await loadConversationData(newConversation.id)
        
        // Clear URL parameters and reset quote request state
        router.replace('/parts')
        setHasHandledQuoteRequest(false)
        setQuoteRequestId(null)
        setIsLoadingQuoteContext(false)
        
        setShowChatHistory(false)
      }
    } catch (error) {
      console.error("Error creating conversation:", error)
    }
  }

  const handleVehicleSelect = (vehicle: Vehicle) => {
    console.log('[New Chat Flow] Vehicle selected:', {
      id: vehicle.id,
      vehicleId: vehicle.vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
    })
    
    const vehicleContext = {
      id: vehicle.id,
      vehicleId: vehicle.vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
    }
    
    setSelectedVehicle(vehicleContext)
    setShowVehicleSelector(false)
    
    // Create a new conversation with the selected vehicle (pass directly to avoid state timing issues)
    createNewConversation(vehicleContext)
  }

  const loadConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId)
    await loadConversationData(conversationId)
    
    // Clear URL parameters and reset quote request state
    router.replace('/parts')
    setHasHandledQuoteRequest(false)
    setQuoteRequestId(null)
    setIsLoadingQuoteContext(false)
    
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
    <AppLayout activeRoute="/parts">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div>
              <h1 className="text-lg font-bold text-white">AI Parts Assistant</h1>
              <p className="text-xs text-slate-400">
                Get instant help finding parts, checking compatibility, and technical support
              </p>
            </div>
            <div className="flex gap-2">
              {selectedVehicle && (
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-700 rounded-md">
                  <Truck className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-white">
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
                onClick={() => setShowChatHistory(!showChatHistory)}
              >
                <Clock className="w-3 h-3 mr-1" />
                <span className="text-xs">History</span>
              </Button>
              <Dialog open={showVehicleSelector} onOpenChange={setShowVehicleSelector}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
                  onClick={() => setShowVehicleSelector(true)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  <span className="text-xs">New Chat</span>
                </Button>
                <DialogContent className="bg-slate-800 border-slate-700 text-white">
                  <DialogHeader>
                    <DialogTitle>Select a Vehicle</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-slate-400 mb-4">
                      Select a vehicle to get parts assistance specific to your equipment
                    </p>
                    {loadingVehicles ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin h-6 w-6 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                      </div>
                    ) : vehicles.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                        <p className="text-slate-400">No vehicles found</p>
                        <Link href="/vehicles/new">
                          <Button className="mt-4 bg-orange-600 hover:bg-orange-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Vehicle
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-2">
                          {vehicles.map((vehicle) => (
                            <div
                              key={vehicle.id}
                              className="p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                              onClick={() => handleVehicleSelect(vehicle)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    ID: {vehicle.vehicleId} | Type: {vehicle.type}
                                  </div>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-orange-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0">
            <Card className="lg:col-span-3 bg-slate-800 border-slate-700 flex flex-col min-h-0">
              <CardHeader className="border-b border-slate-700 flex-shrink-0 py-1 px-3">
                <CardTitle className="text-white flex items-center gap-2 text-xs">
                  <MessageSquare className="w-4 h-4" />
                  Parts Assistant Chat
                  {currentConversationId && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-orange-600 text-white text-xs ml-2">
                        {conversations.find((c) => c.id === currentConversationId)?.title || "Active"}
                      </Badge>
                      {selectedVehicle && (
                        <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                          <Truck className="w-3 h-3 mr-1" />
                          {selectedVehicle.vehicleId}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden">
                {showChatHistory && (
                  <div className="absolute inset-0 bg-slate-800 z-10 flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">Chat History</h3>
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
                                ? "bg-orange-600 text-white"
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
                    <div className="animate-spin h-8 w-8 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0 p-2">
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${message.role === "USER" ? "justify-end" : "justify-start"}`}
                        >
                          {message.role === "ASSISTANT" && (
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-orange-600 text-white">
                                <Bot className="w-3 h-3" />
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div className="flex flex-col gap-2 max-w-[80%]">
                            {/* Check if this message has duplicates - show carousel */}
                            {message.context?._duplicates && message.context._duplicates.length > 1 ? (
                              <div className="relative px-14">
                                <Carousel className="w-full">
                                  <CarouselContent>
                                    {message.context._duplicates.map((duplicate: ChatMessage, dupIndex: number) => (
                                      <CarouselItem key={duplicate.id}>
                                        <div
                                          className={`rounded-lg p-3 ${
                                            message.role === "USER" ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-100"
                                          }`}
                                        >
                                          {/* Show carousel indicator */}
                                          <div className="mb-2 pb-2 border-b border-slate-600 flex items-center justify-between">
                                            <Badge className="bg-blue-600 text-white text-xs">
                                              Response {dupIndex + 1} of {message.context._duplicateCount}
                                            </Badge>
                                            <span className="text-xs text-slate-400">
                                              {duplicate.context?.metadata?.execution_time_ms}ms • 
                                              {Math.round((duplicate.context?.metadata?.confidence || 0) * 100)}% confidence
                                            </span>
                                          </div>
                                          
                                          {/* Display main content */}
                                          <div className="whitespace-pre-wrap text-sm mb-2">
                                            {duplicate.content}
                                          </div>
                                          
                                          {/* Parse and display context data for assistant messages */}
                                          {duplicate.role === "ASSISTANT" && duplicate.context && (
                                            <MessageContextDisplay 
                                              context={duplicate.context} 
                                              addToPickListFunc={addToPickList} 
                                              setInputMsgFunc={setInputMessage} 
                                            />
                                          )}
                                          
                                          <div className="text-xs mt-2 text-slate-400">
                                            {new Date(duplicate.createdAt).toLocaleTimeString()}
                                          </div>
                                        </div>
                                      </CarouselItem>
                                    ))}
                                  </CarouselContent>
                                  
                                  {/* Sticky navigation arrows - constrained to chat bubble bounds */}
                                  <div className="absolute left-0 top-0 bottom-0 w-10 pointer-events-none -translate-x-full">
                                    <div className="sticky top-[50vh] -translate-y-1/2 pointer-events-auto">
                                      <CarouselPrevious 
                                        className="h-8 w-8 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white shadow-lg" 
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none translate-x-full">
                                    <div className="sticky top-[50vh] -translate-y-1/2 pointer-events-auto">
                                      <CarouselNext 
                                        className="h-8 w-8 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white shadow-lg" 
                                      />
                                    </div>
                                  </div>
                                </Carousel>
                              </div>
                            ) : (
                              <div
                                className={`rounded-lg p-3 ${
                                  message.role === "USER" ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-100"
                                }`}
                              >
                                {/* Display main content */}
                                <div className="whitespace-pre-wrap text-sm mb-2">
                                  {message.content}
                                </div>

                              {/* Parse and display context data for assistant messages */}
                              {message.role === "ASSISTANT" && message.context && (
                                <MessageContextDisplay 
                                  context={message.context} 
                                  addToPickListFunc={addToPickList} 
                                  setInputMsgFunc={setInputMessage} 
                                />
                              )}
                              
                              <div
                                className={`text-xs mt-2 ${message.role === "USER" ? "text-orange-100" : "text-slate-400"}`}
                              >
                                {new Date(message.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                            )}

                            {/* Get part numbers from different sources */}
                            {(() => {
                              let partNumbers: string[] = [];
                              
                              // 1. Extract from message content
                              const contentPartNumbers = extractPartNumbers(message.content);
                              partNumbers = [...partNumbers, ...contentPartNumbers];
                              
                              // 2. Check for part numbers in message context
                              if (message.context) {
                                // Single part number in context
                                if (message.context.partNumber) {
                                  partNumbers.push(message.context.partNumber);
                                }
                                
                                // Multiple part numbers in context
                                if (message.context.partNumbers && Array.isArray(message.context.partNumbers)) {
                                  partNumbers = [...partNumbers, ...message.context.partNumbers];
                                }
                                
                                // Part numbers in search results
                                if (message.context.searchResults &&
                                    message.context.searchResults.results &&
                                    Array.isArray(message.context.searchResults.results)) {
                                  const resultPartNumbers = message.context.searchResults.results
                                    .map((result: any) => result.partNumber)
                                    .filter(Boolean);
                                  partNumbers = [...partNumbers, ...resultPartNumbers];
                                }
                              }
                              
                              // 3. Check for partNumber directly on the message
                              if (message.partNumber) {
                                partNumbers.push(message.partNumber);
                              }
                              
                              // Remove duplicates
                              partNumbers = [...new Set(partNumbers)];
                              
                              // If no part numbers found, don't show buttons
                              if (partNumbers.length === 0) return null;
                              
                              return (
                                <>
                                  {/* Show individual part button if there's only one part number */}
                                  {partNumbers.length === 1 ? (
                                    <Button
                                      onClick={() => addToPickList(partNumbers[0])}
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white self-start"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add {partNumbers[0]} to Pick List
                                    </Button>
                                  ) : (
                                    <>
                                      {/* Show "Add All Parts" button when multiple parts are found */}
                                      <Button
                                        onClick={() => {
                                          partNumbers.forEach(partNumber => {
                                            addToPickList(partNumber);
                                          });
                                        }}
                                        size="sm"
                                        className="bg-orange-600 hover:bg-orange-700 text-white self-start"
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add All Parts to Pick List
                                      </Button>
                                      
                                      {/* Show individual part buttons for each part */}
                                      <div className="flex flex-wrap gap-1 mt-1 self-start">
                                        {partNumbers.map((partNumber) => (
                                          <Button
                                            key={`btn-${partNumber}`}
                                            onClick={() => addToPickList(partNumber)}
                                            size="sm"
                                            variant="outline"
                                            className="bg-green-600 hover:bg-green-700 text-white border-green-500 text-xs py-0 h-6"
                                          >
                                            <Plus className="w-2 h-2 mr-1" />
                                            {partNumber}
                                          </Button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </>
                              );
                            })()}
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
                            <AvatarFallback className="bg-orange-600 text-white">
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

                <div className="p-2 border-t border-slate-700 flex-shrink-0">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        ref={textareaRef}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask about parts, compatibility, pricing, or technical questions..."
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
                      disabled={!inputMessage.trim() || isTyping}
                      className="bg-orange-600 hover:bg-orange-700 text-white self-end"
                      size="sm"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-white text-xs font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="px-3 py-2">
                <div className="space-y-2">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setInputMessage(action.label)}
                    >
                      <action.icon className="w-3 h-3" />
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-white">Pick List</h4>
                    <Badge variant="secondary" className="bg-orange-600 text-white text-xs">
                      {pickList.length}
                    </Badge>
                  </div>

                  {pickList.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-2">
                      <ShoppingCart className="w-4 h-4 mx-auto mb-1 opacity-50" />
                      No items in pick list
                    </div>
                  ) : (
                    <div className="h-28 overflow-hidden">
                      <ScrollArea className="h-full pr-2">
                        <div className="space-y-2">
                        {pickList.map((item) => (
                          <div key={item.id} className="bg-slate-700 rounded p-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-white truncate">{item.partNumber}</div>
                                <div className="text-xs text-slate-400 truncate">{item.description}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-4 w-4 p-0 text-slate-400 hover:text-white"
                                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    >
                                      -
                                    </Button>
                                    <span className="text-xs text-white w-4 text-center">{item.quantity}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-4 w-4 p-0 text-slate-400 hover:text-white"
                                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    >
                                      +
                                    </Button>
                                  </div>
                                  {(item.price || item.estimatedPrice) && (
                                    <div className="text-xs text-green-400">
                                      ${((item.price || item.estimatedPrice || 0) * item.quantity).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 text-slate-400 hover:text-red-400 ml-1"
                                onClick={() => removeFromPickList(item.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {pickList.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-600">
                      <div className="text-xs text-slate-300 mb-2">
                        Total: ${pickList.reduce((sum, item) => sum + (item.price || item.estimatedPrice || 0) * item.quantity, 0).toFixed(2)}
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={async () => {
                          console.log('[Get Quote] Current quoteRequestId state:', quoteRequestId)
                          console.log('[Get Quote] Current pickListId:', pickListId)
                          console.log('[Get Quote] Current conversationId:', currentConversationId)
                          
                          try {
                            // Check if we have a quoteRequestId in state
                            let targetQuoteRequestId = quoteRequestId
                            
                            // If no quoteRequestId in state, check if current pickList is linked to a quote request
                            if (!targetQuoteRequestId && pickListId) {
                              console.log('[Get Quote] No quoteRequestId in state, checking pickList for linked quote')
                              try {
                                const quoteCheckResponse = await fetch(`/api/quote-requests`)
                                const quoteCheckData = await quoteCheckResponse.json()
                                
                                if (quoteCheckData.data) {
                                  const linkedQuote = quoteCheckData.data.find((qr: any) => qr.pickListId === pickListId)
                                  if (linkedQuote) {
                                    targetQuoteRequestId = linkedQuote.id
                                    console.log('[Get Quote] Found linked quote request:', targetQuoteRequestId)
                                  }
                                }
                              } catch (error) {
                                console.error('[Get Quote] Error checking for linked quote:', error)
                              }
                            }
                            
                            if (targetQuoteRequestId) {
                              // UPDATE existing quote request with current pick list items
                              console.log('[Quote Flow] Updating existing quote request:', targetQuoteRequestId)
                              
                              const response = await fetch(`/api/quote-requests/${targetQuoteRequestId}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  items: pickList.map(item => ({
                                    partNumber: item.partNumber,
                                    description: item.description,
                                    quantity: item.quantity,
                                    unitPrice: item.price || item.estimatedPrice,
                                    totalPrice: (item.price || item.estimatedPrice || 0) * item.quantity,
                                  })),
                                }),
                              })
                              
                              const data = await response.json()
                              
                              if (data.data && data.data.id) {
                                // Navigate to the quote request edit page
                                window.location.href = `/orders/quote-request/${targetQuoteRequestId}/edit`
                              } else {
                                throw new Error('Failed to update quote request')
                              }
                            } else {
                              // CREATE new quote request
                              console.log('[Normal Flow] Creating new quote request')
                              
                              // Check if vehicle is selected (required)
                              if (!selectedVehicle?.id) {
                                alert('Please select a vehicle first before creating a quote request')
                                return
                              }
                              
                              // Get the first supplier (we'll let user change it in the edit page)
                              const suppliersResponse = await fetch('/api/suppliers')
                              const suppliersData = await suppliersResponse.json()
                              
                              if (!suppliersData.data || suppliersData.data.length === 0) {
                                alert('Please create a supplier first')
                                return
                              }
                              
                              const firstSupplier = suppliersData.data[0]
                              
                              // Create draft quote request using existing API
                              const response = await fetch('/api/quote-requests', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  supplierId: firstSupplier.id,
                                  title: `Quote Request - ${pickList.length} items`,
                                  items: pickList.map(item => ({
                                    partNumber: item.partNumber,
                                    description: item.description,
                                    quantity: item.quantity,
                                    unitPrice: item.price || item.estimatedPrice,
                                    totalPrice: (item.price || item.estimatedPrice || 0) * item.quantity,
                                  })),
                                  vehicleId: selectedVehicle.id,
                                  pickListId: pickListId,
                                }),
                              })
                              
                              const data = await response.json()
                              
                              console.log('[Normal Flow] Create quote response:', data)
                              
                              if (data.data && data.data.id) {
                                // Navigate to the draft quote request edit page
                                window.location.href = `/orders/quote-request/${data.data.id}/edit`
                              } else {
                                console.error('[Normal Flow] Create quote failed:', data)
                                throw new Error(data.error || 'Failed to create draft quote request')
                              }
                            }
                          } catch (error) {
                            console.error('Error with quote request:', error)
                            alert('Failed to process quote request. Please try again.')
                          }
                        }}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Get Quote
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-white mb-2">AI Capabilities</h4>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>• Part identification & compatibility</div>
                    <div>• Real-time inventory checking</div>
                    <div>• Technical specifications</div>
                    <div>• Pricing & supplier info</div>
                    <div>• Maintenance recommendations</div>
                  </div>
                </div>

                {selectedVehicle && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-xs font-medium text-white mb-2">Vehicle Context</h4>
                    <div className="bg-slate-700 rounded-lg p-2">
                      <div className="text-xs text-white font-medium">
                        {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ID: {selectedVehicle.vehicleId}
                      </div>
                      <div className="text-xs text-slate-400">
                        Type: {selectedVehicle.type}
                      </div>
                      <Link href={`/vehicles/${selectedVehicle.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-xs text-slate-300 hover:bg-slate-600"
                        >
                          View Vehicle Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
    </AppLayout>
  )
}
