import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { CHAT_COPY } from '@shared/copy/chat'
import { CONTENT_SAFETY } from '@shared/constants'
import type { ChatMessage } from '@shared/types/chat'
import type { Pet } from '@shared/types/pet'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { PanelLoading } from '../components/ui/PanelLoading'
import { Toggle } from '../components/ui/Toggle'
import { PanelFrame } from '../components/ui/PanelFrame'

export function ChatPanel(): ReactElement {
  const [pet, setPet] = useState<Pet | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveHistory, setSaveHistory] = useState(true)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      const [activePet, history, settings] = await Promise.all([
        window.petory.pet.getActive(),
        window.petory.chat.getHistory(),
        window.petory.chat.getSettings()
      ])
      setPet(activePet)
      setMessages(history)
      setSaveHistory(settings.enableChatHistory)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    return window.petory.auth.onSessionExpired(({ message }) => {
      setError(message)
      setSending(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleSend = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setError(null)
    setSending(true)
    setInput('')

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      petId: pet?.id ?? '',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }
    setMessages((prev) => [...prev, optimistic])

    const result = await window.petory.chat.send(text)
    setSending(false)

    if (!result.success) {
      setError(result.message)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      return
    }

    if (saveHistory) {
      const history = await window.petory.chat.getHistory()
      setMessages(history)
    } else {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        optimistic,
        result.message
      ])
    }
  }

  const handleToggleHistory = async (next: boolean): Promise<void> => {
    setSaveHistory(next)
    await window.petory.chat.setSettings({ enableChatHistory: next })
    if (next) {
      const history = await window.petory.chat.getHistory()
      setMessages(history)
    }
  }

  if (loading) {
    return <PanelLoading label={CHAT_COPY.loading} />
  }

  if (!pet) {
    return (
      <EmptyState
        title={CHAT_COPY.empty.title}
        description={CHAT_COPY.empty.description}
        actionLabel={CHAT_COPY.empty.action}
        onAction={() => window.petory.pet.openOnboarding({ mode: 'new' })}
      />
    )
  }

  return (
    <PanelFrame
      title={pet.name}
      subtitle={pet.personality}
      onClose={() => window.petory.chat.close()}
      footer={
        <>
          <form className="flex items-center gap-2.5" onSubmit={(e) => void handleSend(e)}>
            <Input
              className="flex-1 bg-petory-surface"
              fullWidth={false}
              placeholder={CHAT_COPY.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !input.trim()}>{CHAT_COPY.send}</Button>
          </form>
          <div className="mt-3 flex items-center justify-between border-t border-petory-border pt-3">
            <Toggle checked={saveHistory} onChange={(next) => void handleToggleHistory(next)} label={CHAT_COPY.saveHistory} />
            <span className="text-[10px] text-petory-text-tertiary">{CHAT_COPY.shortcut}</span>
          </div>
        </>
      }
    >
      <div className="flex min-h-full flex-col px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-petory-primary-soft text-[22px] font-semibold text-petory-primary">
              {pet.name.slice(0, 1)}
            </div>
            <p className="mt-4 text-[15px] font-medium text-petory-text">和{pet.name}聊聊天</p>
            <p className="mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-petory-text-tertiary">{CHAT_COPY.emptyThread}</p>
          </div>
        ) : null}
        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={[
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-[0_1px_2px_rgba(45,42,38,0.04)]',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-petory-primary text-white'
                      : 'rounded-bl-md border border-petory-border bg-petory-surface text-petory-text'
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-petory-primary-soft px-3.5 py-2.5 text-[13px] text-petory-text-secondary">
                  {CHAT_COPY.thinking}
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div ref={bottomRef} />
        )}

        <p className="mt-auto px-2 pt-5 text-center text-[10px] leading-relaxed text-petory-text-tertiary">
          {CONTENT_SAFETY.chat}
        </p>
      </div>

      {error ? (
        <div className="mx-5 mb-3 rounded-xl border border-petory-error/15 bg-petory-error-soft px-3 py-2 text-[12px] text-petory-error" role="alert">
          {error}
        </div>
      ) : null}
    </PanelFrame>
  )
}
