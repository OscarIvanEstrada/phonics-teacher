import AVFoundation
import Capacitor

/// On-device text-to-speech with AVSpeechSynthesizer.
/// `synthesize` renders speech to a 16-bit WAV (returned as base64) so the web layer can cache it;
/// `speak` plays directly and resolves when finished (used for voice previews).
@objc(NativeTTSPlugin)
public class NativeTTSPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "NativeTTSPlugin"
    public let jsName = "NativeTTS"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "synthesize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let player = AVSpeechSynthesizer()
    // `speak` resolves when its utterance finishes or is cancelled
    private var pendingSpeak: CAPPluginCall?

    override public func load() {
        player.delegate = self
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        pendingSpeak?.resolve()
        pendingSpeak = nil
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        pendingSpeak?.resolve()
        pendingSpeak = nil
    }
    // Writers must stay alive until their final (empty) buffer arrives
    private var activeWriters: [UUID: AVSpeechSynthesizer] = [:]

    @objc func getVoices(_ call: CAPPluginCall) {
        let voices = AVSpeechSynthesisVoice.speechVoices().map { voice -> [String: Any] in
            let quality: String
            switch voice.quality {
            case .premium: quality = "premium"
            case .enhanced: quality = "enhanced"
            default: quality = "default"
            }
            let gender: String
            switch voice.gender {
            case .male: gender = "male"
            case .female: gender = "female"
            default: gender = "unspecified"
            }
            var novelty = voice.identifier.contains("speech.synthesis.voice")
            if #available(iOS 17.0, *) {
                novelty = novelty || voice.voiceTraits.contains(.isNoveltyVoice)
            }
            return [
                "id": voice.identifier,
                "name": voice.name,
                "language": voice.language,
                "quality": quality,
                "gender": gender,
                "novelty": novelty,
            ]
        }
        call.resolve(["voices": voices])
    }

    private func makeUtterance(_ call: CAPPluginCall) -> AVSpeechUtterance? {
        guard let text = call.getString("text"), !text.isEmpty else {
            call.reject("text is required")
            return nil
        }
        let utterance: AVSpeechUtterance
        if let ipa = call.getString("ipa"), !ipa.isEmpty {
            // Pronounce `text` exactly as the given IPA (isolated phonics sounds like /æː/ or /kᵊ/)
            let attributed = NSMutableAttributedString(string: text)
            attributed.addAttribute(
                NSAttributedString.Key(rawValue: AVSpeechSynthesisIPANotationAttribute),
                value: ipa,
                range: NSRange(location: 0, length: attributed.length)
            )
            utterance = AVSpeechUtterance(attributedString: attributed)
        } else {
            utterance = AVSpeechUtterance(string: text)
        }
        if let voiceId = call.getString("voiceId"), let voice = AVSpeechSynthesisVoice(identifier: voiceId) {
            utterance.voice = voice
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: call.getString("language") ?? "en-US")
        }
        utterance.rate = call.getFloat("rate") ?? AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = call.getFloat("pitch") ?? 1.0
        return utterance
    }

    @objc func synthesize(_ call: CAPPluginCall) {
        guard let utterance = makeUtterance(call) else { return }

        let id = UUID()
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(id.uuidString).wav")
        let synthesizer = AVSpeechSynthesizer()
        var file: AVAudioFile?
        var finished = false

        let finish: (String?) -> Void = { [weak self] error in
            guard !finished else { return }
            finished = true
            file = nil // closes the file
            DispatchQueue.main.async { self?.activeWriters[id] = nil }
            defer { try? FileManager.default.removeItem(at: url) }
            if let error = error {
                call.reject(error)
                return
            }
            guard let data = try? Data(contentsOf: url), data.count > 44 else {
                call.reject("No audio was produced for this voice")
                return
            }
            call.resolve(["audioBase64": data.base64EncodedString(), "mimeType": "audio/wav"])
        }

        activeWriters[id] = synthesizer
        synthesizer.write(utterance) { buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            if pcm.frameLength == 0 {
                finish(nil)
                return
            }
            do {
                if file == nil {
                    let settings: [String: Any] = [
                        AVFormatIDKey: kAudioFormatLinearPCM,
                        AVSampleRateKey: pcm.format.sampleRate,
                        AVNumberOfChannelsKey: pcm.format.channelCount,
                        AVLinearPCMBitDepthKey: 16,
                        AVLinearPCMIsFloatKey: false,
                        AVLinearPCMIsBigEndianKey: false,
                    ]
                    file = try AVAudioFile(
                        forWriting: url,
                        settings: settings,
                        commonFormat: pcm.format.commonFormat,
                        interleaved: pcm.format.isInterleaved
                    )
                }
                try file?.write(from: pcm)
            } catch {
                finish("Failed writing audio: \(error.localizedDescription)")
            }
        }
    }

    @objc func speak(_ call: CAPPluginCall) {
        guard let utterance = makeUtterance(call) else { return }
        DispatchQueue.main.async {
            self.player.stopSpeaking(at: .immediate)
            self.pendingSpeak?.resolve()
            self.pendingSpeak = call
            self.player.speak(utterance)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player.stopSpeaking(at: .immediate)
            call.resolve()
        }
    }
}

/// Bridge view controller that registers the app-local plugins.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTTSPlugin())
    }
}
