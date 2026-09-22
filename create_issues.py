import csv
import subprocess
import sys

# Configure stdout to utf-8 to prevent charmap errors on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    try:
        with open('docs/backlog-100-fonctionnalites.csv', 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader) # skip header
            count = 0
            for row in reader:
                if not row or len(row) < 2:
                    continue
                count += 1
                
                # Skip the first 23 issues that were already created
                if count <= 23:
                    continue
                
                title = row[0]
                description = row[1]
                
                try:
                    print(f"Creating issue {count}: {title}")
                except UnicodeEncodeError:
                    print(f"Creating issue {count}")
                    
                try:
                    subprocess.run(
                        ['gh', 'issue', 'create', '--title', title, '--body', description],
                        check=True
                    )
                except subprocess.CalledProcessError as e:
                    print(f"Error creating issue {count}")
    except Exception as e:
        print(f"Failed to process CSV: {e}")

if __name__ == '__main__':
    main()
