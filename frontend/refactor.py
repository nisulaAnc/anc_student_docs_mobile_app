import os, re

dirs_to_search = [
    r'd:\My_Files\Projects\anc_project_backups\New folder\anc_student_docs_mobile_app\frontend\src\screens',
    r'd:\My_Files\Projects\anc_project_backups\New folder\anc_student_docs_mobile_app\frontend\src\components'
]

for d in dirs_to_search:
    for root, _, files in os.walk(d):
        for file in files:
            if not file.endswith('.jsx'): continue
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'COLORS' not in content: continue

            # Replace import
            content = re.sub(r'import\s+\{.*COLORS.*\}\s+from\s+[\'\"].*/constants/config[\'\"];', 'import { useTheme } from \'../context/ThemeContext\';', content)
            
            # Replace StyleSheet.create
            if 'const styles = StyleSheet.create({' in content:
                content = content.replace('const styles = StyleSheet.create({', 'const createStyles = (COLORS, theme) => StyleSheet.create({')
            
            # Replace secondary StyleSheet.create if any (like infoStyles)
            if 'const infoStyles = StyleSheet.create({' in content:
                content = content.replace('const infoStyles = StyleSheet.create({', 'const createInfoStyles = (COLORS, theme) => StyleSheet.create({')

            # Insert hook into functional component
            # Find export default function XYZ(...) {
            def repl(m):
                hook = '\n  const { colors: COLORS, theme, toggleTheme } = useTheme();\n  const styles = createStyles ? createStyles(COLORS, theme) : {};'
                if 'createInfoStyles' in content:
                    hook += '\n  const infoStyles = createInfoStyles ? createInfoStyles(COLORS, theme) : {};'
                return m.group(0) + hook

            if 'useTheme()' not in content:
                content = re.sub(r'export default function [a-zA-Z0-9_]+\([^)]*\)\s*\{', repl, content)
                content = re.sub(r'export function [a-zA-Z0-9_]+\([^)]*\)\s*\{', repl, content)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
print('Done!')
