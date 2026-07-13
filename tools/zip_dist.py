"""
Create project_neal_files.zip containing files inside dist/ProjectNeal/
"""
import os, zipfile

def zip_folder(folder_path, output_zip):
    print(f"Compressing {folder_path} to {output_zip}...")
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Store relative path inside zip
                arcname = os.path.relpath(file_path, folder_path)
                zipf.write(file_path, arcname)
    print("Zip created successfully.")

if __name__ == "__main__":
    zip_folder("dist/ProjectNeal", "project_neal_files.zip")
