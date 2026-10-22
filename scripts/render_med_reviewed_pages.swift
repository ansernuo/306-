import Foundation
import AppKit
import PDFKit
let args = CommandLine.arguments
let pdf = PDFDocument(url: URL(fileURLWithPath: args[1]))!
for item in args[3...].map({Int($0)!}) {
    autoreleasepool {
        let page = pdf.page(at: item - 1)!
        let box = page.bounds(for: .mediaBox)
        let scale = CGFloat(150.0 / 72.0)
        let image = page.thumbnail(of: NSSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
        let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
        let data = bitmap.representation(using: .png, properties: [:])!
        try! data.write(to: URL(fileURLWithPath: args[2] + "/page-" + String(format: "%03d", item) + ".png"))
        print(item)
    }
}
