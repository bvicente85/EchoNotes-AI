import React, { useState } from 'react';
import { X, HelpCircle, Monitor, Mic, Lightbulb, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface UserGuideModalProps {
  onClose: () => void;
  language: 'portuguese' | 'english' | string;
}

export function UserGuideModal({ onClose, language }: UserGuideModalProps) {
  const isPt = language === 'portuguese';
  const [activeTab, setActiveTab] = useState<'tips' | 'troubleshoot'>('tips');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-app-border flex justify-between items-center glass shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-app-accent/10 flex items-center justify-center text-app-accent">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-display font-black tracking-tight text-app-fg">
                {isPt ? 'Guia do Utilizador' : 'User Guide'}
              </h2>
              <p className="text-app-fg/40 text-[9px] font-black uppercase tracking-[0.2em] mt-1">
                {isPt ? 'Dicas e Boas Práticas SUMA' : 'SUMA Tips & Best Practices'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-app-accent/10 hover:text-app-accent transition-colors text-app-fg cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-app-border bg-slate-50/50 dark:bg-slate-950/20 px-6 py-2 shrink-0">
          <button
            onClick={() => setActiveTab('tips')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer",
              activeTab === 'tips'
                ? "bg-app-accent/15 text-app-accent"
                : "text-slate-400 hover:text-app-fg hover:bg-white/5"
            )}
          >
            {isPt ? '💡 Dicas de Gravação' : '💡 Recording Tips'}
          </button>
          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ml-2",
              activeTab === 'troubleshoot'
                ? "bg-app-accent/15 text-app-accent"
                : "text-slate-400 hover:text-app-fg hover:bg-white/5"
            )}
          >
            {isPt ? '🛠️ Resolução de Problemas' : '🛠️ Troubleshooting'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-left">
          {activeTab === 'tips' ? (
            // Tips Tab
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-accent flex items-center gap-2">
                  <Monitor size={15} />
                  {isPt ? 'Gravar Reuniões Virtuais Sem Falhas' : 'Flawless Virtual Meeting Recording'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isPt 
                    ? 'Ao gravar reuniões do Zoom, Microsoft Teams ou Google Meet, o navegador captura o som do sistema. Para garantir que nada é interrompido:' 
                    : 'When recording Zoom, Teams, or Google Meet, the browser captures system audio. To ensure no interruptions occur:'}
                </p>
                
                <div className="grid grid-cols-1 gap-4 mt-2">
                  <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-white/5 space-y-1.5">
                    <p className="text-xs font-bold text-app-fg flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-app-accent" />
                      {isPt ? '⚠️ Nunca minimize a janela partilhada!' : '⚠️ Never minimize the shared window!'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-3.5">
                      {isPt 
                        ? 'Se minimizar a janela da reunião para a barra de tarefas, o Windows e o navegador fecham a transmissão de áudio para poupar energia, o que encerra a gravação. Em vez disso, coloque outras janelas por cima (sobreposição).' 
                        : 'If you minimize the meeting window to the taskbar, your OS and browser shut off the audio stream to save power, stopping your recording. Instead, just cover it by clicking on other windows.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-white/5 space-y-1.5">
                    <p className="text-xs font-bold text-app-fg flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-app-accent" />
                      {isPt ? '🖥️ Recomendado: Partilhe o Ecrã Inteiro' : '🖥️ Recommended: Share Entire Screen'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-3.5">
                      {isPt 
                        ? 'Ao partilhar o "Ecrã Inteiro" (com a opção "Partilhar áudio do sistema" ativa), pode minimizar e maximizar qualquer janela à vontade sem nunca interromper o áudio.' 
                        : 'By sharing your "Entire Screen" (with "Share system audio" checked), you are free to minimize, maximize, and drag any windows without stopping the audio.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-white/5 space-y-1.5">
                    <p className="text-xs font-bold text-app-fg flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-app-accent" />
                      {isPt ? '🌐 Use Reuniões no Navegador' : '🌐 Run Meetings in a Web Tab'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-3.5">
                      {isPt 
                        ? 'Se fizer reuniões no navegador (Google Meet/Teams Web), escolha a aba "Separador" ao partilhar. Pode minimizar a janela do navegador que a gravação continuará a correr sem problemas.' 
                        : 'If your meeting is in a browser, choose the "Tab" option when sharing. You can safely minimize the browser and tab-audio will continue recording perfectly.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-app-accent flex items-center gap-2">
                  <Mic size={15} />
                  {isPt ? 'Gravação Presencial Local' : 'Local Mic Recording'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isPt 
                    ? 'Para gravar conversas na mesma sala, use o microfone do computador. Aponte o microfone na direção do grupo e evite ruídos na mesa (como bater com canetas ou arrastar copos).' 
                    : 'For in-room dialogues, direct the computer microphone towards the group and avoid desk noise (like clicking pens or dragging mugs).'}
                </p>
              </div>
            </div>
          ) : (
            // Troubleshooting Tab
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                  <AlertCircle size={15} />
                  {isPt ? 'A gravação parou e apareceu um popup?' : 'Did recording stop and a popup appeared?'}
                </p>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed">
                  {isPt 
                    ? 'Isto acontece se a janela partilhada foi minimizada. Não se preocupe! Todo o áudio gravado até esse segundo está guardado.' 
                    : 'This happens if the shared window was minimized. Do not worry! All audio captured up to that point is safe.'}
                </p>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-bold">
                  {isPt 
                    ? 'Ação: Clique em "Analisar Mais Tarde" (Save to Pending). De seguida, volte a clicar em "Iniciar Gravação" para continuar de onde parou. No final, use o Gemini Chat e peça para "Juntar os últimos dois relatórios".' 
                    : 'Action: Click "Analyze Later" (Save to Pending) to secure the first part. Then immediately click "Start Session" to record the rest. Later, open the Gemini Chat and ask to "Combine my last two sessions".'}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-fg flex items-center gap-2">
                  <Sparkles size={15} className="text-app-accent" />
                  {isPt ? 'Como recuperar gravações perdidas por quebras de energia?' : 'How to recover recordings lost due to power cuts?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isPt 
                    ? 'Se fechar a aba acidentalmente ou o computador desligar, o SUMA recuperará os áudios gravados até à falha. Quando abrir o site novamente, surgirá um painel de recuperação automática no topo do ecrã.' 
                    : 'If you close the tab or experience a power failure, SUMA automatically backs up audio chunks to local storage. The next time you open the site, a recovery banner will appear at the top.'}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-fg flex items-center gap-2">
                  <Lightbulb size={15} className="text-app-accent" />
                  {isPt ? 'O volume está muito baixo?' : 'Is the volume too low?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isPt 
                    ? 'No painel de gravação ativa, consulte o indicador de "Monitor de Microfone". Se o volume estiver baixo, certifique-se de que ativa a opção "Otimizar baixo volume" no painel de parâmetros antes de gravar.' 
                    : 'Check the "Microphone Quality" monitor during active recordings. If the volume levels are low, make sure to check "Optimize low volume" in the session parameters before starting.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-app-border flex justify-end bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-app-accent text-white font-bold rounded-xl text-xs hover:scale-102 transition-transform active:scale-98 cursor-pointer shadow-md"
          >
            {isPt ? 'Entendido' : 'Got it'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
