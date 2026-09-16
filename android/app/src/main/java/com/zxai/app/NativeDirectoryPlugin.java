package com.zxai.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeDirectory")
public class NativeDirectoryPlugin extends Plugin {

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "pickDirectoryResult");
    }

    @ActivityCallback
    private void pickDirectoryResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri treeUri = result.getData().getData();
            if (treeUri != null) {
                final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                try {
                    getContext().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
                } catch (Exception ignored) {
                }

                DocumentFile docFile = DocumentFile.fromTreeUri(getContext(), treeUri);
                String name = null;
                if (docFile != null) {
                    name = docFile.getName();
                }
                if (name == null || name.trim().isEmpty()) {
                    String decoded = Uri.decode(treeUri.toString());
                    int colon = decoded.lastIndexOf(':');
                    if (colon >= 0 && colon < decoded.length() - 1) {
                        String sub = decoded.substring(colon + 1);
                        int slash = sub.lastIndexOf('/');
                        name = slash >= 0 ? sub.substring(slash + 1) : sub;
                    }
                }
                if (name == null || name.trim().isEmpty()) {
                    name = "Carpeta Android";
                }

                JSObject ret = new JSObject();
                ret.put("uri", treeUri.toString());
                ret.put("name", name);
                ret.put("cancelled", false);
                call.resolve(ret);
                return;
            }
        }

        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("uri es requerido");
            return;
        }
        try {
            Uri uri = Uri.parse(uriStr);
            DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
            boolean granted = root != null && root.exists() && root.canRead();
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void listDirectory(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path", "");
        if (uriStr == null) {
            call.reject("uri es requerido");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            DocumentFile dir = clean.isEmpty() ? root : findFileOrDirectory(root, clean);

            if (dir == null || !dir.exists() || !dir.isDirectory()) {
                call.reject("Directorio no encontrado: " + path);
                return;
            }

            DocumentFile[] files = dir.listFiles();
            JSArray entries = new JSArray();
            for (DocumentFile file : files) {
                String name = file.getName();
                if (name == null) continue;
                JSObject item = new JSObject();
                item.put("name", name);
                String childPath = clean.isEmpty() ? name : clean + "/" + name;
                item.put("path", childPath);
                item.put("type", file.isDirectory() ? "directory" : "file");
                item.put("size", file.length());
                item.put("modifiedAt", file.lastModified());
                entries.put(item);
            }

            JSObject ret = new JSObject();
            ret.put("entries", entries);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path");
        if (uriStr == null || path == null) {
            call.reject("uri y path son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            DocumentFile file = findFileOrDirectory(root, clean);

            if (file == null || !file.exists() || !file.isFile()) {
                call.reject("Archivo no encontrado: " + path);
                return;
            }

            long length = file.length();
            if (length > 5_000_000) {
                call.reject("El archivo es demasiado grande (" + length + " bytes)");
                return;
            }

            InputStream is = getContext().getContentResolver().openInputStream(file.getUri());
            if (is == null) {
                throw new IOException("No se pudo abrir el archivo para lectura");
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int len;
            while ((len = is.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            is.close();

            String text = new String(baos.toByteArray(), StandardCharsets.UTF_8);
            JSObject ret = new JSObject();
            ret.put("text", text);
            ret.put("size", length);
            ret.put("modifiedAt", file.lastModified());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path");
        String content = call.getString("content", "");

        if (uriStr == null || path == null) {
            call.reject("uri y path son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            if (clean.isEmpty()) {
                call.reject("Ruta de archivo inválida");
                return;
            }

            int lastSlash = clean.lastIndexOf('/');
            String dirPath = lastSlash >= 0 ? clean.substring(0, lastSlash) : "";
            String fileName = lastSlash >= 0 ? clean.substring(lastSlash + 1) : clean;

            DocumentFile parentDir = findOrCreateDirectory(root, dirPath);
            DocumentFile file = parentDir.findFile(fileName);
            if (file == null) {
                file = parentDir.createFile("application/octet-stream", fileName);
                if (file == null) {
                    throw new IOException("No se pudo crear el archivo: " + fileName);
                }
            }

            ContentResolver resolver = getContext().getContentResolver();
            OutputStream os = resolver.openOutputStream(file.getUri(), "wt");
            if (os == null) {
                throw new IOException("No se pudo abrir el archivo para escritura");
            }
            try {
                byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                os.write(bytes);
                os.flush();
            } finally {
                os.close();
            }

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void createFile(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path");
        String content = call.getString("content", "");

        if (uriStr == null || path == null) {
            call.reject("uri y path son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            if (clean.isEmpty()) {
                call.reject("Ruta inválida");
                return;
            }

            DocumentFile existing = findFileOrDirectory(root, clean);
            if (existing != null && existing.exists()) {
                call.reject("Ya existe un archivo o carpeta en: " + clean);
                return;
            }

            int lastSlash = clean.lastIndexOf('/');
            String dirPath = lastSlash >= 0 ? clean.substring(0, lastSlash) : "";
            String fileName = lastSlash >= 0 ? clean.substring(lastSlash + 1) : clean;

            DocumentFile parentDir = findOrCreateDirectory(root, dirPath);
            DocumentFile file = parentDir.createFile("application/octet-stream", fileName);
            if (file == null) {
                throw new IOException("No se pudo crear el archivo: " + fileName);
            }

            if (content != null && !content.isEmpty()) {
                OutputStream os = getContext().getContentResolver().openOutputStream(file.getUri(), "wt");
                if (os != null) {
                    try {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                    } finally {
                        os.close();
                    }
                }
            }

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void createDirectory(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path");
        if (uriStr == null || path == null) {
            call.reject("uri y path son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            findOrCreateDirectory(root, cleanPath(path));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path");
        if (uriStr == null || path == null) {
            call.reject("uri y path son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            DocumentFile target = findFileOrDirectory(root, cleanPath(path));
            if (target == null || !target.exists()) {
                call.reject("Elemento no encontrado: " + path);
                return;
            }
            if (!target.delete()) {
                call.reject("No se pudo eliminar: " + path);
                return;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void renameEntry(PluginCall call) {
        String uriStr = call.getString("uri");
        String from = call.getString("from");
        String to = call.getString("to");
        if (uriStr == null || from == null || to == null) {
            call.reject("uri, from y to son requeridos");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String cleanFrom = cleanPath(from);
            String cleanTo = cleanPath(to);

            DocumentFile target = findFileOrDirectory(root, cleanFrom);
            if (target == null || !target.exists()) {
                call.reject("Elemento no encontrado: " + cleanFrom);
                return;
            }

            int fromSlash = cleanFrom.lastIndexOf('/');
            int toSlash = cleanTo.lastIndexOf('/');
            String fromParent = fromSlash >= 0 ? cleanFrom.substring(0, fromSlash) : "";
            String toParent = toSlash >= 0 ? cleanTo.substring(0, toSlash) : "";
            String newName = toSlash >= 0 ? cleanTo.substring(toSlash + 1) : cleanTo;

            if (fromParent.equals(toParent)) {
                if (!target.renameTo(newName)) {
                    call.reject("No se pudo renombrar a: " + newName);
                    return;
                }
                call.resolve();
                return;
            }

            DocumentFile destParent = findOrCreateDirectory(root, toParent);
            if (target.isFile()) {
                DocumentFile newFile = destParent.findFile(newName);
                if (newFile != null) {
                    newFile.delete();
                }
                newFile = destParent.createFile("application/octet-stream", newName);
                if (newFile == null) {
                    call.reject("No se pudo crear el destino: " + cleanTo);
                    return;
                }
                copyStream(target.getUri(), newFile.getUri());
                target.delete();
                call.resolve();
            } else {
                copyDirectoryRecursive(target, destParent, newName);
                target.delete();
                call.resolve();
            }
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stat(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path", "");
        if (uriStr == null) {
            call.reject("uri es requerido");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            DocumentFile file = clean.isEmpty() ? root : findFileOrDirectory(root, clean);
            if (file == null || !file.exists()) {
                call.reject("Elemento no encontrado: " + path);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("path", clean);
            ret.put("type", file.isDirectory() ? "directory" : "file");
            ret.put("size", file.length());
            ret.put("modifiedAt", file.lastModified());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void exists(PluginCall call) {
        String uriStr = call.getString("uri");
        String path = call.getString("path", "");
        if (uriStr == null) {
            call.reject("uri es requerido");
            return;
        }

        try {
            DocumentFile root = getTreeRoot(uriStr);
            String clean = cleanPath(path);
            DocumentFile file = clean.isEmpty() ? root : findFileOrDirectory(root, clean);
            JSObject ret = new JSObject();
            ret.put("exists", file != null && file.exists());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("exists", false);
            call.resolve(ret);
        }
    }

    private DocumentFile getTreeRoot(String uriStr) throws IOException {
        Uri uri = Uri.parse(uriStr);
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
        if (root == null || !root.exists()) {
            throw new FileNotFoundException("No se pudo acceder a la carpeta: " + uriStr);
        }
        return root;
    }

    private String cleanPath(String path) {
        if (path == null) return "";
        String p = path.trim().replace('\\', '/');
        while (p.startsWith("/")) p = p.substring(1);
        while (p.endsWith("/")) p = p.substring(0, p.length() - 1);
        if (p.equals(".")) return "";
        return p;
    }

    private DocumentFile findFileOrDirectory(DocumentFile root, String path) {
        if (path == null) return root;
        String clean = cleanPath(path);
        if (clean.isEmpty()) return root;

        String[] segments = clean.split("/+");
        DocumentFile current = root;
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            DocumentFile next = current.findFile(segment);
            if (next == null) {
                return null;
            }
            current = next;
        }
        return current;
    }

    private DocumentFile findOrCreateDirectory(DocumentFile root, String path) throws IOException {
        if (path == null) return root;
        String clean = cleanPath(path);
        if (clean.isEmpty()) return root;

        String[] segments = clean.split("/+");
        DocumentFile current = root;
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            DocumentFile next = current.findFile(segment);
            if (next == null) {
                next = current.createDirectory(segment);
                if (next == null) {
                    throw new IOException("No se pudo crear el directorio: " + segment);
                }
            } else if (!next.isDirectory()) {
                throw new IOException("La ruta '" + segment + "' no es un directorio");
            }
            current = next;
        }
        return current;
    }

    private void copyStream(Uri src, Uri dst) throws IOException {
        try (InputStream in = getContext().getContentResolver().openInputStream(src);
             OutputStream out = getContext().getContentResolver().openOutputStream(dst, "wt")) {
            if (in == null || out == null) throw new IOException("Error al abrir stream de datos");
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
            out.flush();
        }
    }

    private void copyDirectoryRecursive(DocumentFile srcDir, DocumentFile targetParent, String newDirName) throws IOException {
        DocumentFile newDir = targetParent.findFile(newDirName);
        if (newDir == null) {
            newDir = targetParent.createDirectory(newDirName);
            if (newDir == null) throw new IOException("No se pudo crear la carpeta: " + newDirName);
        }
        for (DocumentFile child : srcDir.listFiles()) {
            String name = child.getName();
            if (name == null) continue;
            if (child.isDirectory()) {
                copyDirectoryRecursive(child, newDir, name);
            } else {
                DocumentFile childDst = newDir.findFile(name);
                if (childDst != null) childDst.delete();
                childDst = newDir.createFile("application/octet-stream", name);
                if (childDst != null) {
                    copyStream(child.getUri(), childDst.getUri());
                }
            }
        }
    }
}
