import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { Box,List,ListItemButton,ListItemIcon,ListItemText } from '@mui/material';
import React from 'react';

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [], isFile: false };
  paths.forEach((p) => {
    const segs = p.split('/');
    let node = root;
    segs.forEach((seg, i) => {
      const isFile = i === segs.length - 1;
      let child = node.children.find((c) => c.name === seg && c.isFile === isFile);
      if (!child) {
        child = { name: seg, path: segs.slice(0, i + 1).join('/'), children: [], isFile };
        node.children.push(child);
      }
      node = child;
    });
  });
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1);
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

interface FileTreeProps {
  paths: string[];
  selected: string;
  binaryPaths: Set<string>;
  onSelect: (path: string) => void;
}

export function FileTree({ paths, selected, binaryPaths, onSelect }: FileTreeProps) {
  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
  nodes.map((n) =>
  n.isFile ?
  <ListItemButton
    key={n.path}
    selected={n.path === selected}
    aria-current={n.path === selected ? 'page' : undefined}
    onClick={() => onSelect(n.path)}
    sx={{ pl: 1 + depth * 2, py: 0.25 }}>

          <ListItemIcon sx={{ minWidth: 28 }}>
            {binaryPaths.has(n.path) ? <ImageOutlinedIcon sx={{ fontSize: 18 }} /> : <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />}
          </ListItemIcon>
          <ListItemText primary={n.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
        </ListItemButton> :

  <Box key={n.path} role="group" aria-label={n.path}>
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 + depth * 2, py: 0.5, color: 'text.secondary' }}>
            <FolderOutlinedIcon sx={{ fontSize: 18, mr: 1.25 }} />
            <Box component="span" sx={{ fontSize: 14 }}>{n.name}</Box>
          </Box>
          {render(n.children, depth + 1)}
        </Box>

  );

  return (
    <List dense disablePadding aria-label="文件目录">
      {render(buildTree(paths), 0)}
    </List>);

}
